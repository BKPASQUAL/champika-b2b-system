import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

/**
 * Find or auto-create Champika Hardware as a customer in an agency portal.
 * Returns the customer ID.
 */
export async function ensureCustomerInAgency(
  agencyBusinessId: string,
  customerName: string,
): Promise<string | null> {
  // Check if customer already exists in this agency
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", agencyBusinessId)
    .ilike("shop_name", `%${customerName}%`)
    .maybeSingle();

  if (existing) return existing.id;

  // Auto-create the internal Champika Hardware customer
  const { data: created, error } = await supabaseAdmin
    .from("customers")
    .insert({
      shop_name: customerName,
      owner_name: "Champika Hardware",
      phone: "",
      address: "Internal - Champika Hardware",
      route: "Internal",
      status: "Active",
      credit_limit: 99999999,
      outstanding_balance: 0,
      business_id: agencyBusinessId,
    })
    .select()
    .single();

  if (error) {
    console.error(`Failed to auto-create customer "${customerName}" in agency:`, error);
    return null;
  }

  return created.id;
}

/**
 * Generate or update the monthly inter-branch bill for one agency.
 *
 * - Aggregates all order_items for the current month from targetBusinessId
 *   where the product supplier name matches agencyName.
 * - Bills at product cost_price.
 * - Creates a fixed monthly invoice (e.g. OR-RE-2026-04) or updates it if it exists.
 */
export async function generateInterBranchBill(params: {
  agencyBusinessId: string;
  agencyName: string;       // "Orange" | "Wireman" | "Sierra"
  invoicePrefix: string;    // e.g. "OR-RE", "RE", "SI-RE"
  customerId: string;
  customerName: string;
  targetBusinessId: string; // Champika Retail or Distribution
}): Promise<void> {
  const { agencyBusinessId, agencyName, invoicePrefix, customerId, customerName, targetBusinessId } = params;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();

  // Use plain date strings to avoid timezone issues with date columns
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const fixedInvoiceNo = `${invoicePrefix}-${year}-${monthStr}`;

  console.log(`[InterBranch] ${agencyName} | ${customerName} | ${startDate} → ${endDate} | invoice: ${fixedInvoiceNo}`);

  // Validate that customerId belongs to agencyBusinessId (prevents cross-portal data corruption)
  const { data: customerCheck } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", agencyBusinessId)
    .maybeSingle();

  if (!customerCheck) {
    throw new Error(`[InterBranch] Customer ${customerId} does not belong to agency ${agencyBusinessId} (${agencyName}). Aborting to prevent data corruption.`);
  }

  // Fetch all agency-supplier order items for this month from target business
  const { data: sales, error } = await supabaseAdmin
    .from("order_items")
    .select(
      `
      quantity,
      product_id,
      orders!inner (
        order_date,
        business_id,
        status
      ),
      products!inner (
        id,
        name,
        supplier_name,
        cost_price
      )
    `,
    )
    .eq("orders.business_id", targetBusinessId)
    .neq("orders.status", "Cancelled")
    .ilike("products.supplier_name", `%${agencyName}%`)
    .gte("orders.order_date", startDate)
    .lte("orders.order_date", endDate);

  if (error) throw new Error(`[InterBranch] Fetch error (${agencyName}): ${error.message}`);

  console.log(`[InterBranch] ${agencyName} found ${sales?.length ?? 0} order_items`);

  if (!sales || sales.length === 0) return;

  // Aggregate by product_id, billing at cost_price
  const productMap = new Map<
    string,
    { productId: string; quantity: number; unitPrice: number; totalPrice: number }
  >();

  sales.forEach((sale: any) => {
    const pId = sale.product_id;
    const cost = Number(sale.products?.cost_price) || 0;
    const qty = Number(sale.quantity) || 0;
    const lineTotal = qty * cost;

    if (productMap.has(pId)) {
      const existing = productMap.get(pId)!;
      existing.quantity += qty;
      existing.totalPrice += lineTotal;
    } else {
      productMap.set(pId, { productId: pId, quantity: qty, unitPrice: cost, totalPrice: lineTotal });
    }
  });

  let totalBillAmount = 0;
  const orderItemsToInsert: any[] = [];

  productMap.forEach((item) => {
    totalBillAmount += item.totalPrice;
    orderItemsToInsert.push({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      free_quantity: 0,
      commission_earned: 0,
    });
  });

  if (totalBillAmount === 0) return;

  // Check if this month's invoice already exists
  const { data: existingInvoice } = await supabaseAdmin
    .from("invoices")
    .select("id, total_amount, order_id")
    .eq("invoice_no", fixedInvoiceNo)
    .maybeSingle();

  if (existingInvoice) {
    // --- UPDATE existing monthly bill ---
    const previousAmount = Number(existingInvoice.total_amount) || 0;
    const difference = totalBillAmount - previousAmount;

    await supabaseAdmin
      .from("invoices")
      .update({ total_amount: totalBillAmount, customer_id: customerId })
      .eq("id", existingInvoice.id);

    if (existingInvoice.order_id) {
      await supabaseAdmin
        .from("orders")
        .update({ total_amount: totalBillAmount, customer_id: customerId, updated_at: new Date() })
        .eq("id", existingInvoice.order_id);

      // Replace order items with freshly aggregated list
      await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("order_id", existingInvoice.order_id);

      await supabaseAdmin
        .from("order_items")
        .insert(orderItemsToInsert.map((item) => ({ ...item, order_id: existingInvoice.order_id })));
    }

    // Adjust customer outstanding balance by the difference
    if (difference !== 0) {
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", customerId)
        .single();

      if (cust) {
        await supabaseAdmin
          .from("customers")
          .update({ outstanding_balance: (cust.outstanding_balance || 0) + difference })
          .eq("id", customerId);
      }
    }
  } else {
    // --- CREATE new monthly bill ---
    const agencyPrefix = agencyName.toUpperCase().slice(0, 2);
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_id: `ORD-${agencyPrefix}-${Date.now()}`,
        customer_id: customerId,
        business_id: agencyBusinessId,
        total_amount: totalBillAmount,
        status: "Delivered",
        notes: `Auto-generated monthly bill for ${customerName} (${agencyName} Items) - ${now.toLocaleString("default", { month: "long" })} ${year}`,
        order_date: startDate,
      })
      .select()
      .single();

    if (orderError) throw new Error(`[InterBranch] Order insert failed (${agencyName}): ${orderError.message}`);

    const { error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_no: fixedInvoiceNo,
        order_id: orderData.id,
        customer_id: customerId,
        total_amount: totalBillAmount,
        paid_amount: 0,
        status: "Unpaid",
        due_date: endDate,
      });

    if (invoiceError) throw new Error(`[InterBranch] Invoice insert failed (${agencyName}): ${invoiceError.message}`);

    await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert.map((item) => ({ ...item, order_id: orderData.id })));

    // Add bill total to customer outstanding balance
    const { data: cust } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", customerId)
      .single();

    if (cust) {
      await supabaseAdmin
        .from("customers")
        .update({ outstanding_balance: (cust.outstanding_balance || 0) + totalBillAmount })
        .eq("id", customerId);
    }
  }
}

// -----------------------------------------------------------------------
// Agency configuration map
// -----------------------------------------------------------------------

interface AgencyConfig {
  agencyBusinessId: string;
  agencyName: string;
  retailPrefix: string;
  distributionPrefix: string;
}

export const AGENCY_CONFIGS: AgencyConfig[] = [
  {
    agencyBusinessId: BUSINESS_IDS.ORANGE_AGENCY,
    agencyName: "Orange",
    retailPrefix: "OR-RE",
    distributionPrefix: "OR-DI",
  },
  {
    agencyBusinessId: BUSINESS_IDS.WIREMAN_AGENCY,
    agencyName: "Wireman",
    retailPrefix: "RE",
    distributionPrefix: "DI",
  },
  {
    agencyBusinessId: BUSINESS_IDS.SIERRA_AGENCY,
    agencyName: "Sierra",
    retailPrefix: "SI-RE",
    distributionPrefix: "SI-DI",
  },
];

/**
 * Main auto-trigger function called after a Champika invoice is created.
 *
 * Checks which agency items are present in the invoice, then for each:
 *  1. Finds or auto-creates Champika Hardware as a customer in the agency portal.
 *  2. Regenerates/updates the current month's inter-branch bill.
 */
export async function triggerAgencyBillsForInvoice(
  targetBusinessId: string, // Champika Retail or Distribution business ID
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;

  console.log(`[InterBranch] trigger called | businessId=${targetBusinessId} | products=${productIds.length}`);

  // Fetch supplier names for all products in the invoice
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, supplier_name")
    .in("id", productIds);

  if (error || !products) {
    console.error("[InterBranch] Failed to fetch product supplier names:", error);
    return;
  }

  const supplierNames = products.map((p) => (p.supplier_name || "").toLowerCase());
  console.log(`[InterBranch] supplier names found:`, supplierNames);

  const isRetail = targetBusinessId === BUSINESS_IDS.CHAMPIKA_RETAIL;
  const customerName = isRetail
    ? "Champika Hardware - Retail"
    : "Champika Hardware - Distribution";

  for (const agency of AGENCY_CONFIGS) {
    const hasAgencyItems = supplierNames.some((s) =>
      s.includes(agency.agencyName.toLowerCase()),
    );

    console.log(`[InterBranch] ${agency.agencyName}: hasItems=${hasAgencyItems}`);
    if (!hasAgencyItems) continue;

    const invoicePrefix = isRetail ? agency.retailPrefix : agency.distributionPrefix;

    const customerId = await ensureCustomerInAgency(agency.agencyBusinessId, customerName);
    if (!customerId) continue;

    await generateInterBranchBill({
      agencyBusinessId: agency.agencyBusinessId,
      agencyName: agency.agencyName,
      invoicePrefix,
      customerId,
      customerName,
      targetBusinessId,
    });
  }
}
