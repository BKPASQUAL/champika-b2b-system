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
  userId: z.string().optional(),
  isDraft: z.boolean().optional(),
  changeReason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
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

    const fullInvoice = {
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      date: invoice.created_at.split("T")[0],
      customerId: invoice.customer_id,
      salesRepId: invoice.orders?.sales_rep_id,
      orderStatus: invoice.orders?.status,
      notes: invoice.orders?.notes,
      grandTotal: invoice.total_amount,
      // For Print Utils
      customer: {
        shop: invoice.customers?.shop_name || "",
        name: invoice.customers?.owner_name || "",
        phone: invoice.customers?.phone || "",
        address: invoice.customers?.address || "",
      },
      salesRep: invoice.orders?.profiles?.full_name || "Unknown",
      totals: { grandTotal: invoice.total_amount },
      // Items
      items: items.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        sku: item.products?.sku,
        productName: item.products?.name,
        // Map name/price for Print Utils
        name: item.products?.name,
        price: item.unit_price,
        free: item.free_quantity,

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

    // 1. Fetch Current Invoice State (Snapshot for History)
    // FIX: We removed 'order_items (*)' from this query because they are not directly on invoices table
    const { data: currentInvoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        orders (*)
      `
      )
      .eq("id", id)
      .single();

    if (invError || !currentInvoice) {
      console.error("Invoice fetch error:", invError); // Log the actual error
      return NextResponse.json(
        { error: "Invoice not found or DB error" },
        { status: 404 }
      );
    }

    // 2. Fetch Items Separately for Snapshot
    const { data: currentItems } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", currentInvoice.order_id);

    // 3. Save Snapshot to History
    if (val.userId) {
      // Combine invoice and items for the snapshot record
      const snapshotData = {
        ...currentInvoice,
        items: currentItems,
      };

      await supabaseAdmin.from("invoice_history").insert({
        invoice_id: id,
        previous_data: snapshotData, // Save complete object
        changed_by: val.userId,
        change_reason: val.changeReason || "Updated details",
      });
    }

    // 4. Prepare Updates
    const newStatus = val.isDraft ? "Pending" : val.orderStatus;

    // --- REVERT OLD STOCK & BALANCE ---

    // A. Revert Customer Balance
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", currentInvoice.customer_id)
      .single();

    if (customer) {
      const revertedBalance =
        (customer.outstanding_balance || 0) - currentInvoice.total_amount;
      await supabaseAdmin
        .from("customers")
        .update({ outstanding_balance: revertedBalance })
        .eq("id", currentInvoice.customer_id);
    }

    // B. Revert Stock (Using the items fetched in step 2)
    if (currentItems) {
      for (const item of currentItems) {
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
        .eq("order_id", currentInvoice.order_id);
    }

    // --- APPLY NEW DATA ---

    // Update Order
    await supabaseAdmin
      .from("orders")
      .update({
        customer_id: val.customerId,
        sales_rep_id: val.salesRepId,
        order_date: val.invoiceDate,
        status: newStatus,
        total_amount: val.grandTotal,
        notes: val.notes,
      })
      .eq("id", currentInvoice.order_id);

    // Update Invoice
    await supabaseAdmin
      .from("invoices")
      .update({
        customer_id: val.customerId,
        total_amount: val.grandTotal,
      })
      .eq("id", id);

    // Insert New Items
    const newItemsData = val.items.map((item) => ({
      order_id: currentInvoice.order_id,
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

    // Deduct New Stock
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

    // Update Customer Balance (Add new total)
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
