import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";

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
  // Performer info (logged-in user who created this invoice)
  performedByName: z.string().optional().nullable(),
  performedByEmail: z.string().optional().nullable(),
});

// --- GET: Fetch All Invoices ---
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const repId = searchParams.get("repId");

    // Step 1: if filtering by business, get the customer IDs for that business first
    let customerIds: string[] | null = null;
    if (businessId) {
      const { data: customers, error: custError } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("business_id", businessId);
      if (custError) throw custError;
      customerIds = (customers ?? []).map((c: any) => c.id);
      // If no customers found for this business, return empty
      if (customerIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    // Step 2 (rep filter): build a precise list of order IDs the rep is allowed
    // to see, using reliable pre-queries rather than fragile joined-table filters.
    //
    // Rule:
    //   a) Any order the rep created themselves (sales_rep_id = repId)
    //   b) Orders for the rep's customers that came from distribution / admin
    //      (i.e. NOT from the retail business) — so retail cash-customer invoices
    //      never leak into the rep portal.
    let repOrderIds: string[] | null = null;
    if (repId) {
      // a) All orders the rep created
      const { data: ownOrders, error: ownErr } = await supabaseAdmin
        .from("orders")
        .select("id, customer_id")
        .eq("sales_rep_id", repId);
      if (ownErr) throw ownErr;

      const ownOrderRows = ownOrders ?? [];
      const ownIds = ownOrderRows.map((o: any) => o.id as string);

      // Unique customer IDs from the rep's own orders
      const repCustomerIds = [
        ...new Set(
          ownOrderRows.map((o: any) => o.customer_id).filter(Boolean) as string[],
        ),
      ];

      // b) Orders for those customers created by distribution/admin portals
      //    (exclude retail so retail cash-customer invoices stay out)
      let nonRetailIds: string[] = [];
      if (repCustomerIds.length > 0) {
        const { data: nonRetailOrders, error: nrErr } = await supabaseAdmin
          .from("orders")
          .select("id")
          .in("customer_id", repCustomerIds)
          .neq("business_id", BUSINESS_IDS.CHAMPIKA_RETAIL);
        if (nrErr) throw nrErr;
        nonRetailIds = (nonRetailOrders ?? []).map((o: any) => o.id as string);
      }

      repOrderIds = [...new Set([...ownIds, ...nonRetailIds])];

      // Rep has no relevant orders → return empty immediately
      if (repOrderIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    let query = supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name,
          business_id
        ),
        orders!inner (
          status,
          order_date,
          business_id,
          sales_rep_id,
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

    // Step 3: filter invoices to only those belonging to this business's customers
    if (customerIds !== null) {
      query = query.in("customer_id", customerIds);
    }

    // Step 4: filter by the precise set of order IDs allowed for this rep
    if (repOrderIds !== null) {
      query = query.in("order_id", repOrderIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Map to frontend format
    const invoices = data.map((inv: any) => {
      const repName = inv.orders?.profiles?.full_name || "Unknown";
      const orderStatus = inv.orders?.status || "Pending";
      const bId = inv.orders?.business_id ?? inv.customers?.business_id ?? null;

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
        manualInvoiceNo: inv.manual_invoice_no, // ✅ Explicitly Mapped
        orderId: inv.order_id,
        date: inv.orders?.order_date
          ? new Date(inv.orders.order_date).toISOString().split("T")[0]
          : inv.created_at
            ? new Date(inv.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
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
    // 1. Resolve business_id first — needed to determine invoice prefix.
    //    If not sent (e.g. rep portal), look it up from the customer.
    // -------------------------------------------------------------
    let resolvedBusinessId: string | null = val.businessId || null;
    if (!resolvedBusinessId) {
      const { data: custBizData } = await supabaseAdmin
        .from("customers")
        .select("business_id")
        .eq("id", val.customerId)
        .single();
      resolvedBusinessId = custBizData?.business_id || null;
    }

    // -------------------------------------------------------------
    // 2. Generate Invoice Number with per-business prefix
    //    Distribution → CHD-0001 | Retail → CHR-0001
    //    Orange → OR-0001 | Sierra → SI-0001 | Wireman → WI-0001
    //    Rep portal (no business) → INV-0001
    // -------------------------------------------------------------
    const INVOICE_PREFIXES: Record<string, string> = {
      [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "CHD",
      [BUSINESS_IDS.CHAMPIKA_RETAIL]:       "CHR",
      [BUSINESS_IDS.ORANGE_AGENCY]:         "OR",
      [BUSINESS_IDS.SIERRA_AGENCY]:         "SI",
      [BUSINESS_IDS.WIREMAN_AGENCY]:        "WI",
    };
    const prefix = resolvedBusinessId
      ? (INVOICE_PREFIXES[resolvedBusinessId] ?? "INV")
      : "INV";

    const { data: lastInvoice } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .ilike("invoice_no", `${prefix}-%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSeq = 1;
    if (lastInvoice?.invoice_no) {
      const parts = lastInvoice.invoice_no.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }

    const invoiceNo = `${prefix}-${String(nextSeq).padStart(4, "0")}`;
    // -------------------------------------------------------------

    // 3. Calculate Dates
    const invoiceDate =
      val.invoiceDate || new Date().toISOString().split("T")[0];
    const dueDate =
      val.dueDate ||
      (() => {
        const date = new Date(invoiceDate);
        date.setDate(date.getDate() + 30);
        return date.toISOString().split("T")[0];
      })();

    // 4. Create Order Record
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
        business_id: resolvedBusinessId,
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
        resolvedBusinessId === BUSINESS_IDS.CHAMPIKA_RETAIL
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
      .select("outstanding_balance, shop_name")
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

    // 10. Auto-trigger inter-branch agency bills
    // resolvedBusinessId is already correctly set (from val.businessId or customer lookup).
    // If it's a Champika business, scan the invoice items for agency supplier products
    // and create/update the monthly bill in each matching agency portal.
    const champikaBusinessIds: string[] = [
      BUSINESS_IDS.CHAMPIKA_RETAIL,
      BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
    ];

    if (resolvedBusinessId && champikaBusinessIds.includes(resolvedBusinessId)) {
      const productIds = val.items.map((i) => i.productId);
      try {
        await triggerAgencyBillsForInvoice(resolvedBusinessId, productIds);
      } catch (err) {
        console.error("Inter-branch auto-billing failed (non-critical):", err);
      }
    }

    // 11. Save Activity Record (non-critical — never fail the whole request)
    let activityRecordId: string | null = null;
    try {
      const businessName = resolvedBusinessId
        ? (BUSINESS_NAMES as Record<string, string>)[resolvedBusinessId] ?? "Unknown Business"
        : null;

      // Determine portal and action_type from businessId
      const isRetail = resolvedBusinessId === BUSINESS_IDS.CHAMPIKA_RETAIL;
      const portal = resolvedBusinessId ? "office" : "rep";
      const actionType = isRetail
        ? "retail_invoice"
        : resolvedBusinessId
        ? "distribution_invoice"
        : "rep_order";
      const recordType = isRetail
        ? "Retail Invoice"
        : resolvedBusinessId
        ? "Distribution Invoice"
        : "Rep Order";

      // Server-side fallback: if the frontend didn't send performer info,
      // look it up from the profiles table using salesRepId.
      let performedByName = val.performedByName ?? null;
      let performedByEmail = val.performedByEmail ?? null;
      if (!performedByName && val.salesRepId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", val.salesRepId)
          .maybeSingle();
        if (profile) {
          performedByName = profile.full_name ?? null;
          performedByEmail = profile.email ?? performedByEmail;
        }
      }

      const { data: actRec, error: actRecError } = await supabaseAdmin.from("activity_records").insert({
        portal,
        business_id: resolvedBusinessId,
        business_name: businessName,
        action_type: actionType,
        record_type: recordType,
        entity_type: "invoice",
        entity_id: invoiceData.id,
        entity_no: val.manual_invoice_no || invoiceNo,
        customer_id: val.customerId,
        customer_name: customer?.shop_name ?? null,
        amount: val.grandTotal,
        performed_by_id: val.salesRepId,
        performed_by_name: performedByName,
        performed_by_email: performedByEmail,
        metadata: {
          invoiceNo,
          orderId,
          grandTotal: val.grandTotal,
          paidAmount: val.paidAmount,
          paymentStatus: val.paymentStatus,
          orderStatus: val.orderStatus,
          itemCount: val.items.length,
        },
      }).select("id").single();

      if (actRecError) {
        console.error("Activity record (invoice) DB error:", actRecError.message, actRecError.code);
      }
      activityRecordId = actRec?.id ?? null;
    } catch (actErr) {
      console.error("Activity record (invoice) failed (non-critical):", actErr);
    }

    return NextResponse.json(
      {
        message: "Order created successfully",
        invoiceNo: invoiceNo,
        manualInvoiceNo: val.manual_invoice_no,
        orderId: orderId,
        data: invoiceData,
        activityRecordId,
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
