// app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schemas ---
const invoiceItemSchema = z.object({
  productId: z.string(),
  sku: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unit: z.string().optional(),
  mrp: z.number(),
  unitPrice: z.number(),
  discountPercent: z.number().default(0),
  discountAmount: z.number().default(0),
  total: z.number(),
});

const updateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  salesRepId: z.string().min(1),
  invoiceDate: z.string(),
  orderStatus: z.string(),
  items: z.array(invoiceItemSchema).min(1),
  grandTotal: z.number(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Fetch Invoice
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers (
          id,
          shop_name,
          owner_name,
          phone,
          address
        ),
        orders (
          id,
          sales_rep_id,
          status,
          notes,
          profiles!orders_sales_rep_id_fkey (
            full_name
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (invError || !invoice) throw new Error("Invoice not found");

    // 2. Fetch Items via Order ID
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        *,
        products (
          id,
          name,
          sku,
          mrp,
          selling_price,
          stock_quantity,
          unit_of_measure
        )
      `
      )
      .eq("order_id", invoice.order_id);

    if (itemsError) throw itemsError;

    // --- MAPPING FIX FOR PRINT UTILS ---
    const fullInvoice = {
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      date: invoice.created_at.split("T")[0],
      customerId: invoice.customer_id,
      salesRepId: invoice.orders?.sales_rep_id,
      orderStatus: invoice.orders?.status,
      notes: invoice.orders?.notes,
      grandTotal: invoice.total_amount, // Kept for Edit page compatibility

      // 1. Add 'customer' object for print-utils
      customer: {
        shop: invoice.customers?.shop_name || "",
        name: invoice.customers?.owner_name || "",
        phone: invoice.customers?.phone || "",
        address: invoice.customers?.address || "",
      },

      // 2. Add 'salesRep' string for print-utils
      // Note: Adjust 'profiles' access if your relationship name differs
      salesRep: invoice.orders?.profiles?.full_name || "Unknown",

      // 3. Add 'totals' object for print-utils
      totals: {
        grandTotal: invoice.total_amount,
      },

      items: items.map((item: any) => ({
        id: item.id,
        productId: item.product_id,

        // Original fields for Edit Page
        sku: item.products?.sku,
        productName: item.products?.name,
        unit: item.products?.unit_of_measure,
        quantity: item.quantity,
        freeQuantity: item.free_quantity,
        mrp: item.products?.mrp,
        unitPrice: item.unit_price,
        discountPercent: 0,
        total: item.total_price,
        stockAvailable:
          (item.products?.stock_quantity || 0) +
          item.quantity +
          item.free_quantity,

        // 4. Mapped fields for print-utils (it expects: name, price, free)
        name: item.products?.name,
        price: item.unit_price,
        free: item.free_quantity,
      })),
    };

    return NextResponse.json(fullInvoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const val = updateInvoiceSchema.parse(body);

    // 1. Fetch Current Invoice (to get order_id & old totals)
    const { data: oldInvoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, customer_id, total_amount")
      .eq("id", id)
      .single();

    if (invError || !oldInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // 2. Fetch Old Items (to revert stock)
    const { data: oldItems } = await supabaseAdmin
      .from("order_items")
      .select("product_id, quantity, free_quantity")
      .eq("order_id", oldInvoice.order_id);

    // --- REVERT OLD STATE ---

    // A. Revert Customer Balance (Subtract old total)
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", oldInvoice.customer_id)
      .single();

    if (customer) {
      const revertedBalance =
        (customer.outstanding_balance || 0) - oldInvoice.total_amount;
      await supabaseAdmin
        .from("customers")
        .update({ outstanding_balance: revertedBalance })
        .eq("id", oldInvoice.customer_id);
    }

    // B. Revert Stock (Add back old quantities)
    if (oldItems) {
      for (const item of oldItems) {
        const { data: prod } = await supabaseAdmin
          .from("products")
          .select("stock_quantity")
          .eq("id", item.product_id)
          .single();

        if (prod) {
          await supabaseAdmin
            .from("products")
            .update({
              stock_quantity:
                prod.stock_quantity + item.quantity + item.free_quantity,
            })
            .eq("id", item.product_id);
        }
      }
      // C. Delete Old Items
      await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("order_id", oldInvoice.order_id);
    }

    // --- APPLY NEW STATE ---

    // 3. Update Order Header
    await supabaseAdmin
      .from("orders")
      .update({
        customer_id: val.customerId,
        sales_rep_id: val.salesRepId,
        order_date: val.invoiceDate,
        status: val.orderStatus,
        total_amount: val.grandTotal,
        notes: val.notes,
      })
      .eq("id", oldInvoice.order_id);

    // 4. Update Invoice Header
    await supabaseAdmin
      .from("invoices")
      .update({
        customer_id: val.customerId,
        total_amount: val.grandTotal,
      })
      .eq("id", id);

    // 5. Insert New Items
    const newItemsData = val.items.map((item) => ({
      order_id: oldInvoice.order_id,
      product_id: item.productId,
      quantity: item.quantity,
      free_quantity: item.freeQuantity,
      unit_price: item.unitPrice,
      total_price: item.total,
      commission_earned: 0,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(newItemsData);

    if (insertError) throw insertError;

    // 6. Deduct New Stock
    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;

      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      if (prod) {
        await supabaseAdmin
          .from("products")
          .update({
            stock_quantity: Math.max(0, prod.stock_quantity - totalQty),
          })
          .eq("id", item.productId);
      }
    }

    // 7. Update Customer Balance (Add new total)
    const { data: currentCustomer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", val.customerId)
      .single();

    if (currentCustomer) {
      await supabaseAdmin
        .from("customers")
        .update({
          outstanding_balance:
            (currentCustomer.outstanding_balance || 0) + val.grandTotal,
        })
        .eq("id", val.customerId);
    }

    return NextResponse.json({ message: "Invoice updated successfully" });
  } catch (error: any) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
