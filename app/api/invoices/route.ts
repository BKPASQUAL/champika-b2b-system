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
  unit: z.string().optional().or(z.literal("")),
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
    .default("Pending"),
});

// --- GET: Fetch All Invoices ---
export async function GET() {
  try {
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
          status, 
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
      const repName = inv.orders?.profiles?.full_name || "Unknown";
      // ✅ EXTRACT ORDER STATUS
      const orderStatus = inv.orders?.status || "Pending";

      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        orderId: inv.order_id,
        customerId: inv.customer_id,
        customerName: inv.customers?.shop_name || "Unknown Customer",
        salesRepName: repName,
        totalAmount: inv.total_amount,
        paidAmount: inv.paid_amount,
        dueAmount: inv.due_amount,
        status: inv.status,
        orderStatus: orderStatus, // ✅ ADDED
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

// --- POST: Create New Order / Invoice ---
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

    // 3. Create Order Record
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
        created_by: val.salesRepId,
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

    // 5. Create Invoice Record
    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        order_id: orderData.id,
        customer_id: val.customerId,
        total_amount: val.grandTotal,
        paid_amount: 0,
        status: "Unpaid",
        due_date: dueDate,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 6. Update Customer Balance
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

    // 7. Deduct Stock (Global & Location Specific)

    // 7a. Find the Location assigned to this Rep
    const { data: assignments } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", val.salesRepId)
      .limit(1);

    // Use the first assigned location if available
    const locationId =
      assignments && assignments.length > 0 ? assignments[0].location_id : null;

    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;

      // 7b. Update GLOBAL Stock (Legacy/Master record in products table)
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

      // 7c. Update LOCATION Stock (product_stocks table)
      if (locationId) {
        const { data: pStock } = await supabaseAdmin
          .from("product_stocks")
          .select("quantity")
          .eq("location_id", locationId)
          .eq("product_id", item.productId)
          .single();

        if (pStock) {
          await supabaseAdmin
            .from("product_stocks")
            .update({
              quantity: Math.max(0, (pStock.quantity || 0) - totalQty),
            })
            .eq("location_id", locationId)
            .eq("product_id", item.productId);
        }
      }
    }

    return NextResponse.json(
      {
        message: "Order created successfully",
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
