import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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
  // ✅ Discount Fields
  discountPercent: z.number().default(0),
  discountAmount: z.number().default(0),
  total: z.number(), // Line total (Qty * Price - Item Discount)
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  salesRepId: z.string().min(1, "Sales representative is required"),
  businessId: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  // ✅ NEW: Manual Invoice Number Field
  manual_invoice_no: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  subTotal: z.number(),
  // ✅ Extra Discount Fields
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
          ),
          order_items (
            quantity,
            free_quantity,
            actual_unit_cost,
            total_price
          )
        )
      `,
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

      // --- 💰 PROFIT CALCULATION ---
      let totalProfit = 0;
      const items = inv.orders?.order_items || [];

      items.forEach((item: any) => {
        const revenue = item.total_price || 0;
        const cost = (item.quantity || 0) * (item.actual_unit_cost || 0);
        totalProfit += revenue - cost;
      });

      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        manualInvoiceNo: inv.manual_invoice_no,
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
        businessId: bId,
        profit: totalProfit,
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

    // -------------------------------------------------------------
    // 1. Generate Invoice Number (FIXED LOGIC)
    // -------------------------------------------------------------
    // Find the last invoice created to determine the next sequence number.
    // We sort by created_at DESC to find the most recent one.
    const { data: lastInvoice } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .ilike("invoice_no", "INV-%") // Only check auto-generated ones
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextId = 1001; // Default start

    if (lastInvoice && lastInvoice.invoice_no) {
      // Expect format "INV-XXXX"
      const parts = lastInvoice.invoice_no.split("-");
      if (parts.length === 2) {
        const lastNum = parseInt(parts[1], 10);
        if (!isNaN(lastNum)) {
          nextId = lastNum + 1;
        }
      }
    }

    const invoiceNo = `INV-${nextId}`;
    // -------------------------------------------------------------

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
    // Use TIMESTAMP for unique Order ID to avoid collisions
    const orderId = `ORD-${Date.now()}`;

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
        business_id: val.businessId,
        extra_discount_percent: val.extraDiscountPercent,
        extra_discount_amount: val.extraDiscountAmount,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // --- 4. Prepare Order Items & Calculate Commissions ---

    const productIds = val.items.map((i) => i.productId);

    const { data: products } = await supabaseAdmin
      .from("products")
      .select(
        "id, commission_type, commission_value, cost_price, actual_cost_price",
      )
      .in("id", productIds);

    let totalCommissionForOrder = 0;
    const grossSubtotal = val.items.reduce((sum, item) => sum + item.total, 0);
    const globalDiscountAmount = val.extraDiscountAmount || 0;

    const orderItems = val.items.map((item) => {
      const product = products?.find((p) => p.id === item.productId);

      let commissionEarned = 0;

      if (product) {
        if (product.commission_type === "percentage") {
          const itemTotal = item.unitPrice * item.quantity;
          commissionEarned =
            (itemTotal * (product.commission_value || 0)) / 100;
        } else if (product.commission_type === "fixed") {
          commissionEarned = (product.commission_value || 0) * item.quantity;
        }
      }

      totalCommissionForOrder += commissionEarned;

      // Actual Selling Price Calculation
      const totalQty = item.quantity + item.freeQuantity;
      const discountShare =
        grossSubtotal > 0
          ? (item.total / grossSubtotal) * globalDiscountAmount
          : 0;
      const netLineTotal = item.total - discountShare;
      const actualUnitPrice = netLineTotal / totalQty;
      const historicalCost =
        product?.actual_cost_price || product?.cost_price || 0;

      return {
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        free_quantity: item.freeQuantity,
        unit_price: item.unitPrice,
        actual_unit_price: actualUnitPrice,
        actual_unit_cost: historicalCost,
        total_price: item.total,
        commission_earned: commissionEarned,
        discount_percent: item.discountPercent,
        discount_amount: item.discountAmount,
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
        manual_invoice_no: val.manual_invoice_no || null,
        order_id: orderData.id,
        customer_id: val.customerId,
        total_amount: val.grandTotal,
        paid_amount: val.paidAmount,
        status: val.paymentStatus,
        due_date: dueDate,
        created_at: new Date(),
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 7. Record Payment
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

      // Auto-Deposit to Retail Cash if applicable
      if (
        val.paymentType === "Cash" &&
        val.businessId === BUSINESS_IDS.CHAMPIKA_RETAIL
      ) {
        const { data: retailCashAccount } = await supabaseAdmin
          .from("bank_accounts")
          .select("id, current_balance")
          .eq("account_name", "Retail Cash")
          .single();

        if (retailCashAccount) {
          await supabaseAdmin.from("account_transactions").insert({
            transaction_no: `TXN-${Date.now()}`,
            transaction_type: "Sales",
            from_account_id: null,
            to_account_id: retailCashAccount.id,
            amount: val.paidAmount,
            description: `Walk-in Sale - ${invoiceNo}`,
            transaction_date: invoiceDate,
          });

          const newBalance =
            (retailCashAccount.current_balance || 0) + val.paidAmount;

          await supabaseAdmin
            .from("bank_accounts")
            .update({ current_balance: newBalance })
            .eq("id", retailCashAccount.id);
        }
      }
    }

    // 8. Update Customer Balance
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

    // 9. Deduct Stock
    const { data: assignments } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", val.salesRepId);

    const assignedLocationIds = assignments
      ? assignments.map((a) => a.location_id)
      : [];

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
              (product.stock_quantity || 0) - totalQty,
            ),
          })
          .eq("id", item.productId);
      }

      // Location Stock
      if (assignedLocationIds.length > 0) {
        let remainingToDeduct = totalQty;
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

            await supabaseAdmin
              .from("product_stocks")
              .update({ quantity: available - deduct })
              .eq("id", stockRec.id);

            remainingToDeduct -= deduct;
          }
        }
      }
    }

    return NextResponse.json(
      {
        message: "Order created successfully",
        invoiceNo: invoiceNo,
        manualInvoiceNo: val.manual_invoice_no,
        orderId: orderId,
        data: invoiceData,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
