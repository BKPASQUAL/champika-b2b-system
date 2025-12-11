// app/api/invoices/route.ts

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
  businessId: z.string().optional(),
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
      "In Transit",
      "Delivered",
      "Completed",
      "Cancelled",
    ])
    .default("Pending"),
  // Payment Fields
  paymentType: z.enum(["Cash", "Credit", "Cheque"]).default("Cash"),
  paymentStatus: z
    .enum(["Paid", "Unpaid", "Partial", "Overdue"])
    .default("Unpaid"),
  paidAmount: z.number().default(0),
});

// --- GET: Fetch All Invoices ---
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    // Start building the query
    // We use !inner on orders to allow filtering the parent (invoices) by the child's (orders) property
    let query = supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name
        ),
        orders!inner (
          status,
          business_id, 
          profiles!orders_sales_rep_id_fkey (
            full_name
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    // Apply Business Filter if provided
    if (businessId) {
      query = query.eq("orders.business_id", businessId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Map to frontend format
    const invoices = data.map((inv: any) => {
      const repName = inv.orders?.profiles?.full_name || "Unknown";
      const orderStatus = inv.orders?.status || "Pending";
      const bId = inv.orders?.business_id;

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
        orderStatus: orderStatus,
        dueDate: inv.due_date,
        createdAt: inv.created_at,
        businessId: bId, // Return business ID for frontend use
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
        business_id: val.businessId, // Save Business ID
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // --- 4. Prepare Order Items & Calculate Commissions ---

    // 4a. Fetch Product Commission Info
    const productIds = val.items.map((i) => i.productId);
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, commission_type, commission_value")
      .in("id", productIds);

    let totalCommissionForOrder = 0;

    // 4b. Map items with calculated commission
    const orderItems = val.items.map((item) => {
      const product = products?.find((p) => p.id === item.productId);

      let commissionEarned = 0;

      // Calculate Commission Item-Wise
      if (product) {
        if (product.commission_type === "percentage") {
          // (Unit Price * Qty * Rate) / 100
          const itemTotal = item.unitPrice * item.quantity;
          commissionEarned =
            (itemTotal * (product.commission_value || 0)) / 100;
        } else if (product.commission_type === "fixed") {
          // Rate * Qty
          commissionEarned = (product.commission_value || 0) * item.quantity;
        }
      }

      totalCommissionForOrder += commissionEarned;

      return {
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        free_quantity: item.freeQuantity,
        unit_price: item.unitPrice,
        total_price: item.total,
        commission_earned: commissionEarned,
      };
    });

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // --- 5. Record Total Rep Commission ---
    if (totalCommissionForOrder > 0) {
      await supabaseAdmin.from("rep_commissions").insert({
        rep_id: val.salesRepId,
        order_id: orderData.id,
        total_commission_amount: totalCommissionForOrder,
        status: "Pending",
        payout_date: null,
      });
    }

    // 6. Create Invoice Record
    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        order_id: orderData.id,
        customer_id: val.customerId,
        total_amount: val.grandTotal,
        paid_amount: val.paidAmount, // Use actual paid amount
        status: val.paymentStatus, // Use actual status (Paid/Unpaid)
        due_date: dueDate,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 7. Record Payment (If Paid)
    if (val.paidAmount > 0) {
      await supabaseAdmin.from("payments").insert({
        invoice_id: invoiceData.id,
        customer_id: val.customerId,
        amount: val.paidAmount,
        payment_date: invoiceDate,
        method: val.paymentType,
        collected_by: val.salesRepId,
        cheque_status: val.paymentType === "Cheque" ? "Pending" : "Cleared",
      });
    }

    // 8. Update Customer Balance (Only add the UNPAID portion)
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", val.customerId)
      .single();

    if (customer) {
      const pendingAmount = val.grandTotal - val.paidAmount;

      if (pendingAmount !== 0) {
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance:
              (customer.outstanding_balance || 0) + pendingAmount,
          })
          .eq("id", val.customerId);
      }
    }

    // 9. Deduct Stock (Global & Location Specific)
    const { data: assignments } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", val.salesRepId)
      .limit(1);

    const locationId =
      assignments && assignments.length > 0 ? assignments[0].location_id : null;

    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;

      // Global Stock
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

      // Location Stock
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
