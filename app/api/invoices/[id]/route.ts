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
  // ✅ Added Discount Fields
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
  // ✅ Added Extra Discount Fields
  extraDiscountPercent: z.number().default(0),
  extraDiscountAmount: z.number().default(0),
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
          extra_discount_percent,
          extra_discount_amount,
          profiles!orders_sales_rep_id_fkey (
            full_name
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (invError || !invoice) throw new Error("Invoice not found");

    // Fetch Order Items
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

    // Fetch Payments
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .order("payment_date", { ascending: false });

    if (paymentsError) throw paymentsError;

    const fullInvoice = {
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      date: invoice.created_at.split("T")[0],
      customerId: invoice.customer_id,
      salesRepId: invoice.orders?.sales_rep_id,
      orderStatus: invoice.orders?.status,
      notes: invoice.orders?.notes,
      grandTotal: invoice.total_amount,
      paidAmount: invoice.paid_amount,

      // ✅ Map Extra Discount
      extraDiscountPercent: invoice.orders?.extra_discount_percent || 0,
      extraDiscountAmount: invoice.orders?.extra_discount_amount || 0,

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

        // ✅ Map Item Discount
        discountPercent: item.discount_percent || 0,
        discountAmount: item.discount_amount || 0,

        total: item.total_price,
        stockAvailable:
          (item.products?.stock_quantity || 0) +
          item.quantity +
          item.free_quantity,
      })),

      // Payments
      payments: payments || [],
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
      console.error("Invoice fetch error:", invError);
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
      const snapshotData = {
        ...currentInvoice,
        items: currentItems,
      };

      await supabaseAdmin.from("invoice_history").insert({
        invoice_id: id,
        previous_data: snapshotData,
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

    // B. Revert Stock (Global Only - Simplification as we can't track exact location return without complex logs)
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
        // ✅ Update Extra Discount
        extra_discount_percent: val.extraDiscountPercent,
        extra_discount_amount: val.extraDiscountAmount,
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
      // ✅ Update Item Discount
      discount_percent: item.discountPercent,
      discount_amount: item.discountAmount,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(newItemsData);

    if (insertError) throw insertError;

    // ------------------------------------------------------------------
    // Deduct New Stock (Global & Location Specific - Matching POST Logic)
    // ------------------------------------------------------------------

    // 1. Get ALL assigned locations for the user
    const { data: assignments } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", val.salesRepId);

    const assignedLocationIds = assignments
      ? assignments.map((a) => a.location_id)
      : [];

    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;

      // 2. Deduct Global Stock
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

      // 3. Deduct Location Stock (Smart Logic)
      if (assignedLocationIds.length > 0) {
        let remainingToDeduct = totalQty;

        // Fetch stock records for this product in user's locations
        const { data: locationStocks } = await supabaseAdmin
          .from("product_stocks")
          .select("id, location_id, quantity")
          .eq("product_id", item.productId)
          .in("location_id", assignedLocationIds)
          .gt("quantity", 0)
          .order("quantity", { ascending: false });

        if (locationStocks) {
          for (const stockRec of locationStocks) {
            if (remainingToDeduct <= 0) break;

            const available = stockRec.quantity;
            const deduct = Math.min(available, remainingToDeduct);

            // Update this specific stock record
            await supabaseAdmin
              .from("product_stocks")
              .update({
                quantity: available - deduct,
              })
              .eq("id", stockRec.id);

            remainingToDeduct -= deduct;
          }
        }
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
