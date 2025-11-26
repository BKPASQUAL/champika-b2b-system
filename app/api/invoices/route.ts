// app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schemas ---

const invoiceItemSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unit: z.string(),
  mrp: z.number(),
  unitPrice: z.number(),
  discountPercent: z.number().default(0),
  discountAmount: z.number().default(0),
  total: z.number(),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  salesRepId: z.string().min(1, "Sales representative is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  subTotal: z.number(),
  extraDiscountPercent: z.number().default(0),
  extraDiscountAmount: z.number().default(0),
  grandTotal: z.number(),
  notes: z.string().optional(),
  orderStatus: z
    .enum([
      "Pending",
      "Processing",
      "Checking",
      "Loading",
      "Delivered",
      "Cancelled",
    ])
    .default("Delivered"),
});

// --- GET: Fetch All Invoices ---
export async function GET() {
  try {
    // We use !orders_sales_rep_id_fkey to tell Supabase exactly which relationship to join
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name
        ),
        orders (
          profiles!orders_sales_rep_id_fkey (
            full_name
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map to frontend format
    const invoices = data.map((inv: any) => {
      // Safely access the nested profile name
      const repName = inv.orders?.profiles?.full_name || "Unknown";

      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        orderId: inv.order_id,
        customerId: inv.customer_id,
        customerName: inv.customers?.shop_name || "Unknown Customer",
        salesRepName: repName, // Mapped here
        totalAmount: inv.total_amount,
        paidAmount: inv.paid_amount,
        dueAmount: inv.due_amount,
        status: inv.status,
        dueDate: inv.due_date,
        createdAt: inv.created_at,
      };
    });

    return NextResponse.json(invoices);
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Create New Invoice ---
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = invoiceSchema.parse(body);

    // 1. Generate Invoice Number
    const { count } = await supabaseAdmin
      .from("invoices")
      .select("*", { count: "exact", head: true });

    const nextId = (count || 0) + 1001;
    const invoiceNo = `INV-${nextId}`;

    // 2. Calculate Dates
    const invoiceDate =
      val.invoiceDate || new Date().toISOString().split("T")[0];
    const dueDate =
      val.dueDate ||
      (() => {
        const date = new Date(invoiceDate);
        date.setDate(date.getDate() + 30);
        return date.toISOString().split("T")[0];
      })();

    // 3. Create Order
    const { count: orderCount } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true });

    const nextOrderId = (orderCount || 0) + 1001;
    const orderId = `ORD-${nextOrderId}`;

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_id: orderId,
        customer_id: val.customerId,
        sales_rep_id: val.salesRepId,
        order_date: invoiceDate,
        status: val.orderStatus,
        total_amount: val.grandTotal,
        notes: val.notes || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 4. Insert Order Items
    const orderItems = val.items.map((item) => ({
      order_id: orderData.id,
      product_id: item.productId,
      quantity: item.quantity,
      free_quantity: item.freeQuantity,
      unit_price: item.unitPrice,
      total_price: item.total,
      commission_earned: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // 5. Create Invoice
    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        order_id: orderData.id,
        customer_id: val.customerId,
        total_amount: val.grandTotal,
        paid_amount: 0,
        // due_amount is calculated automatically by DB
        status: "Unpaid",
        due_date: dueDate,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 6. Update Customer Balance
    const { error: balanceError } = await supabaseAdmin.rpc(
      "update_customer_balance",
      {
        p_customer_id: val.customerId,
        p_amount: val.grandTotal,
      }
    );

    if (balanceError) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", val.customerId)
        .single();

      if (customer) {
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance:
              (customer.outstanding_balance || 0) + val.grandTotal,
          })
          .eq("id", val.customerId);
      }
    }

    // 7. Update Stock
    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;

      await supabaseAdmin.rpc("decrement_stock", {
        p_product_id: item.productId,
        p_quantity: totalQty,
      });

      const { data: product } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      if (product) {
        await supabaseAdmin
          .from("products")
          .update({
            stock_quantity: Math.max(
              0,
              (product.stock_quantity || 0) - totalQty
            ),
          })
          .eq("id", item.productId);
      }
    }

    return NextResponse.json(
      {
        message: "Invoice created successfully",
        invoiceNo: invoiceNo,
        orderId: orderId,
        data: invoiceData,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
