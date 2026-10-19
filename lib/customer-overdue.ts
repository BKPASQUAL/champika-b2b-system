import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export type CustomerUnlockType = "one_time" | "7_days" | "14_days";
export type CustomerUnlockStatus = "pending" | "approved" | "rejected" | "used" | "expired" | "resolved";

export interface OverdueInvoiceDetail {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  daysOverdue: number;
  dueAmount: number;
  totalAmount: number;
  supplierNames?: string[];
  hasOrangeOrSierra?: boolean;
  thresholdDays?: number;
}

export interface ActiveCustomerUnlock {
  id: string;
  unlockType: CustomerUnlockType;
  approvedAt: string;
  expiresAt: string;
  approvedByName: string;
}

export interface PendingCustomerUnlock {
  id: string;
  unlockType: CustomerUnlockType;
  requestedAt: string;
  reason: string;
  requestedByName?: string;
}

export interface CustomerOverdueStatusResult {
  customerId: string;
  customerName: string;
  customerStatus: string;
  isBlocked: boolean;
  hasOverdue: boolean;
  blockReason?: string;
  totalOverdueAmount: number;
  oldestDaysOverdue: number;
  overdueInvoices: OverdueInvoiceDetail[];
  activeUnlock: ActiveCustomerUnlock | null;
  pendingRequest: PendingCustomerUnlock | null;
  isFeatureDisabled?: boolean;
  isUserExempt?: boolean;
  enforcementMode?: "enforced" | "globally_disabled" | "user_exempt" | "business_exempt" | "walkin_exempt";
}

export interface OverdueBlockingConfig {
  globalEnabled: boolean; // default: true
  defaultEnforced: boolean; // default: true
  userOverrides: Record<string, boolean>; // userId -> boolean (true: enforced, false: exempt/bypassed)
  exemptRoles?: string[]; // array of role names exempt from blocking
  updatedAt?: string;
  updatedBy?: string;
}

export const OVERDUE_BLOCKING_CONFIG_KEY = "customer_overdue_blocking_config";

export const DEFAULT_OVERDUE_BLOCKING_CONFIG: OverdueBlockingConfig = {
  globalEnabled: true,
  defaultEnforced: true,
  userOverrides: {},
  exemptRoles: [],
};

export async function getOverdueBlockingConfig(): Promise<OverdueBlockingConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", OVERDUE_BLOCKING_CONFIG_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return { ...DEFAULT_OVERDUE_BLOCKING_CONFIG };
    }

    const val = data.value as any;
    return {
      globalEnabled: typeof val.globalEnabled === "boolean" ? val.globalEnabled : true,
      defaultEnforced: typeof val.defaultEnforced === "boolean" ? val.defaultEnforced : true,
      userOverrides: val.userOverrides && typeof val.userOverrides === "object" ? val.userOverrides : {},
      exemptRoles: Array.isArray(val.exemptRoles) ? val.exemptRoles : [],
      updatedAt: val.updatedAt,
      updatedBy: val.updatedBy,
    };
  } catch (err) {
    console.warn("Error reading overdue blocking config from app_settings:", err);
    return { ...DEFAULT_OVERDUE_BLOCKING_CONFIG };
  }
}

export async function saveOverdueBlockingConfig(
  config: Partial<OverdueBlockingConfig>,
  adminName?: string
): Promise<OverdueBlockingConfig> {
  const current = await getOverdueBlockingConfig();
  const updated: OverdueBlockingConfig = {
    ...current,
    ...config,
    userOverrides: {
      ...current.userOverrides,
      ...(config.userOverrides || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: adminName || "Admin",
  };

  await supabaseAdmin
    .from("app_settings")
    .upsert(
      {
        key: OVERDUE_BLOCKING_CONFIG_KEY,
        value: updated as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  return updated;
}

export function isOverdueBlockingEnforcedForUser(
  config: OverdueBlockingConfig,
  userId?: string | null,
  userRole?: string | null
): { isEnforced: boolean; reason: "enforced" | "globally_disabled" | "user_exempt" } {
  // 1. If global master switch is turned OFF
  if (!config.globalEnabled) {
    return { isEnforced: false, reason: "globally_disabled" };
  }

  // 2. If a specific user is identified and has an override
  if (userId && config.userOverrides && typeof config.userOverrides[userId] === "boolean") {
    const userVal = config.userOverrides[userId];
    if (!userVal) {
      return { isEnforced: false, reason: "user_exempt" };
    }
    return { isEnforced: true, reason: "enforced" };
  }

  // 3. If user's role is exempt
  if (userRole && config.exemptRoles && config.exemptRoles.includes(userRole.toLowerCase())) {
    return { isEnforced: false, reason: "user_exempt" };
  }

  // 4. Fallback to defaultEnforced
  const enforced = config.defaultEnforced ?? true;
  return {
    isEnforced: enforced,
    reason: enforced ? "enforced" : "globally_disabled",
  };
}

export interface CustomerUnlockRequestRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  requested_by?: string | null;
  requested_by_name?: string | null;
  requested_by_email?: string | null;
  requested_by_role?: string | null;
  unlock_type: CustomerUnlockType;
  reason: string;
  status: CustomerUnlockStatus;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  expires_at?: string | null;
  used_at?: string | null;
  used_in_invoice_id?: string | null;
  overdue_details?: Record<string, unknown> | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    shop_name?: string;
    phone?: string;
    owner_name?: string;
  } | null;
}

const SETTINGS_KEY = "customer_overdue_unlock_requests";

// Fallback helper to query app_settings when dedicated table is not yet created
async function getRequestsFromSettings(): Promise<CustomerUnlockRequestRecord[]> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (!data?.value || !Array.isArray(data.value)) {
    return [];
  }
  return data.value as CustomerUnlockRequestRecord[];
}

async function saveRequestsToSettings(requests: CustomerUnlockRequestRecord[]): Promise<void> {
  await supabaseAdmin
    .from("app_settings")
    .upsert({
      key: SETTINGS_KEY,
      value: requests as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
}

/**
 * Checks if a given supplier name corresponds to Orange (Orel Corporation) or Sierra Cables Plc.
 */
export function isOrangeOrSierraSupplier(supplierName?: string | null): boolean {
  if (!supplierName) return false;
  const s = supplierName.toLowerCase();
  const isOrange = s.includes("orange");
  const isSierra = s.includes("sierra");
  return isOrange || isSierra;
}

/**
 * Checks if a customer is a retail walk-in or guest customer based on their shop/customer name.
 * Walk-in and guest customers are counter retail sales and are NEVER subject to overdue invoicing blocks.
 */
export function isWalkInOrGuestCustomer(customerName?: string | null): boolean {
  if (!customerName) return false;
  const n = customerName.toLowerCase().trim();
  return (
    n.includes("walk-in") ||
    n.includes("walk in") ||
    n.includes("walking") ||
    n.includes("walkin") ||
    n.includes("guest")
  );
}

/**
 * Determines whether customer overdue invoicing blocking applies to a given business and role context.
 * Rule:
 *  - Overdue invoicing block ONLY applies to Champika Hardware Distribution and Sales Rep portals.
 *  - Retail Division (Champika Retail), Sierra Agency, Orange Agency, and Wireman Agency are EXEMPT.
 */
export function isOverdueBlockingEnforcedForBusiness(
  businessId?: string | null,
  userRole?: string | null,
  isRep?: boolean
): boolean {
  const roleLower = (userRole || "").toLowerCase().trim();
  const isRepRole = isRep || roleLower === "rep" || roleLower === "sales_rep" || roleLower === "salesrep";

  // Rep portals are always subject to overdue blocking
  if (isRepRole) {
    return true;
  }

  // If businessId is provided:
  if (businessId) {
    // Only Champika Distribution is subject to overdue blocking
    return businessId === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
  }

  // If no businessId provided and not rep, default to true (e.g. general distribution queries)
  return true;
}

export interface CheckCustomerOverdueContext {
  userId?: string | null;
  userRole?: string | null;
  businessId?: string | null;
  isRep?: boolean;
}

/**
 * Checks if a customer has overdue unsettled invoices and determines
 * if the customer is blocked or has an active Admin override.
 * Rule:
 *  - Overdue ≥ 60 days for invoices containing Orange (Orel Corporation) or Sierra Cables Plc items
 *  - Overdue ≥ 90 days for invoices containing only other suppliers
 *  - Overdue blocking ONLY applies to Champika Hardware Distribution and Sales Rep portals.
 *  - Retail Division, Sierra Agency, Orange Agency, Wireman Agency, and Walk-in customers are ALWAYS EXEMPT.
 */
export async function checkCustomerOverdueStatus(
  customerId: string,
  userContext?: CheckCustomerOverdueContext
): Promise<CustomerOverdueStatusResult> {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  // 1. Fetch Customer info
  const { data: customer, error: custErr } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name, status, credit_limit, outstanding_balance, business_id")
    .eq("id", customerId)
    .single();

  if (custErr || !customer) {
    throw new Error(custErr?.message || "Customer not found");
  }

  // 1a. Walk-in / Guest Customer Exemption:
  // Retail walk-in sales & guest customer accounts must NEVER be blocked by overdue invoices.
  if (isWalkInOrGuestCustomer(customer.shop_name)) {
    return {
      customerId: customer.id,
      customerName: customer.shop_name,
      customerStatus: customer.status,
      isBlocked: false,
      hasOverdue: false,
      blockReason: undefined,
      totalOverdueAmount: 0,
      oldestDaysOverdue: 0,
      overdueInvoices: [],
      activeUnlock: null,
      pendingRequest: null,
      isFeatureDisabled: false,
      isUserExempt: true,
      enforcementMode: "walkin_exempt",
    };
  }

  // 1b. Business-level Exemption:
  // Overdue invoicing blocking ONLY applies to Champika Hardware Distribution and Rep portals.
  // Retail, Sierra, Orange, and Wireman are EXEMPT.
  const targetBusinessId = userContext?.businessId || customer.business_id || null;
  const isBusinessEnforced = isOverdueBlockingEnforcedForBusiness(
    targetBusinessId,
    userContext?.userRole,
    userContext?.isRep
  );

  if (!isBusinessEnforced) {
    return {
      customerId: customer.id,
      customerName: customer.shop_name,
      customerStatus: customer.status,
      isBlocked: false,
      hasOverdue: false,
      blockReason: undefined,
      totalOverdueAmount: 0,
      oldestDaysOverdue: 0,
      overdueInvoices: [],
      activeUnlock: null,
      pendingRequest: null,
      isFeatureDisabled: false,
      isUserExempt: true,
      enforcementMode: "business_exempt",
    };
  }

  // 2. Fetch all unsettled invoices for this customer with order and products details
  const { data: invoices, error: invErr } = await supabaseAdmin
    .from("invoices")
    .select(`
      id,
      invoice_no,
      manual_invoice_no,
      total_amount,
      paid_amount,
      due_amount,
      status,
      due_date,
      created_at,
      order_id,
      orders (
        id,
        business_id,
        order_date,
        status,
        order_items (
          id,
          products (
            id,
            name,
            supplier_name,
            brand
          )
        )
      )
    `)
    .eq("customer_id", customerId)
    .neq("status", "Paid")
    .order("created_at", { ascending: true });

  if (invErr) {
    console.error("Error fetching invoices for overdue check:", invErr);
  }

  const now = new Date();
  const overdueInvoices: OverdueInvoiceDetail[] = [];
  let totalOverdueAmount = 0;
  let oldestDaysOverdue = 0;

  for (const inv of invoices || []) {
    const rawDue = Number(
      inv.due_amount ?? Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0))
    );

    // Only consider invoices with actual remaining due balance
    if (rawDue <= 0.01) continue;

    const orderData = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
    if (orderData?.status === "Cancelled" || inv.status === "Cancelled") {
      continue;
    }

    const invDateStr = orderData?.order_date || inv.created_at;
    const invDate = new Date(invDateStr);
    const diffDays = Math.floor((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

    // Determine suppliers for this invoice
    let hasOrangeOrSierra = false;
    const supplierNamesSet = new Set<string>();

    if (orderData?.business_id === BUSINESS_IDS.ORANGE_AGENCY) {
      hasOrangeOrSierra = true;
      supplierNamesSet.add("Orange (Orel Corporation)");
    } else if (orderData?.business_id === BUSINESS_IDS.SIERRA_AGENCY) {
      hasOrangeOrSierra = true;
      supplierNamesSet.add("Sierra Cables Plc");
    }

    const orderItems = Array.isArray(orderData?.order_items) ? orderData.order_items : [];
    for (const item of orderItems) {
      const rawProd = item?.products;
      const product: any = Array.isArray(rawProd) ? rawProd[0] : rawProd;
      const supp = product?.supplier_name || product?.brand;
      if (supp) {
        supplierNamesSet.add(String(supp).trim());
        if (isOrangeOrSierraSupplier(supp)) {
          hasOrangeOrSierra = true;
        }
      }
    }

    // Rule:
    // 60+ Days threshold for invoices with Orange (Orel Corporation) or Sierra Cables Plc
    // 90+ Days threshold for invoices containing only other suppliers
    const thresholdDays = hasOrangeOrSierra ? 60 : 90;

    if (diffDays >= thresholdDays) {
      const roundedDue = Math.round(rawDue * 100) / 100;
      totalOverdueAmount += roundedDue;
      if (diffDays > oldestDaysOverdue) {
        oldestDaysOverdue = diffDays;
      }
      overdueInvoices.push({
        id: inv.id,
        invoiceNo: inv.manual_invoice_no || inv.invoice_no || "N/A",
        invoiceDate: invDate.toISOString().split("T")[0],
        dueDate: inv.due_date ? String(inv.due_date).split("T")[0] : null,
        daysOverdue: diffDays,
        dueAmount: roundedDue,
        totalAmount: Number(inv.total_amount || 0),
        supplierNames: Array.from(supplierNamesSet),
        hasOrangeOrSierra,
        thresholdDays,
      });
    }
  }

  // Sort oldest first
  overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const hasOverdue = overdueInvoices.length > 0;

  // 3. Check for Active / Pending Unlock Requests
  const allRequests = await getCustomerUnlockRequests({ customerId });
  let activeUnlock: ActiveCustomerUnlock | null = null;
  let pendingRequest: PendingCustomerUnlock | null = null;

  for (const req of allRequests) {
    if (req.status === "approved") {
      // Check if expired
      const isExpired = req.expires_at ? new Date(req.expires_at) < now : false;
      const isOneTimeUsed = req.unlock_type === "one_time" && Boolean(req.used_at);

      if (!isExpired && !isOneTimeUsed) {
        activeUnlock = {
          id: req.id,
          unlockType: req.unlock_type,
          approvedAt: req.approved_at || req.created_at,
          expiresAt: req.expires_at || "",
          approvedByName: req.approved_by_name || "Admin",
        };
        break; // Found active unlock
      }
    } else if (req.status === "pending" && !pendingRequest) {
      pendingRequest = {
        id: req.id,
        unlockType: req.unlock_type,
        requestedAt: req.created_at,
        reason: req.reason,
        requestedByName: req.requested_by_name || undefined,
      };
    }
  }

  // 4. Check system configuration and user-specific exemption rules
  const blockingConfig = await getOverdueBlockingConfig();
  const { isEnforced, reason: enforcementMode } = isOverdueBlockingEnforcedForUser(
    blockingConfig,
    userContext?.userId,
    userContext?.userRole
  );

  // 5. Determine blocking status
  let isBlocked = false;
  let blockReason: string | undefined = undefined;

  if (customer.status === "Blocked") {
    isBlocked = true;
    blockReason = "Customer account is manually blocked by administration.";
  } else if (hasOverdue) {
    if (activeUnlock) {
      isBlocked = false;
    } else if (!isEnforced) {
      // Overdue blocking is disabled either globally or for this user!
      isBlocked = false;
      if (enforcementMode === "globally_disabled") {
        blockReason = "Overdue invoicing blocking is disabled system-wide by Admin.";
      } else if (enforcementMode === "user_exempt") {
        blockReason = "Overdue invoicing blocking is bypassed for this user by Admin.";
      }
    } else {
      isBlocked = true;
      blockReason = `Customer has ${overdueInvoices.length} invoice(s) exceeding credit limits (Orange/Sierra overdue ≥60 days or other suppliers overdue ≥90 days). Total overdue: LKR ${totalOverdueAmount.toLocaleString()}. Invoicing is blocked until payment is settled or Admin unlocks.`;
    }
  }

  return {
    customerId: customer.id,
    customerName: customer.shop_name,
    customerStatus: customer.status,
    isBlocked,
    hasOverdue,
    blockReason,
    totalOverdueAmount: Math.round(totalOverdueAmount * 100) / 100,
    oldestDaysOverdue,
    overdueInvoices,
    activeUnlock,
    pendingRequest,
    isFeatureDisabled: enforcementMode === "globally_disabled",
    isUserExempt: enforcementMode === "user_exempt",
    enforcementMode,
  };
}

/**
 * Fetch all unlock requests with optional filters.
 */
export async function getCustomerUnlockRequests(filters?: {
  status?: string;
  customerId?: string;
}): Promise<CustomerUnlockRequestRecord[]> {
  const now = new Date();

  // Try dedicated table first
  let records: CustomerUnlockRequestRecord[] = [];
  try {
    let query = supabaseAdmin
      .from("customer_unlock_requests")
      .select(`
        *,
        customers (
          shop_name,
          phone,
          owner_name
        )
      `)
      .order("created_at", { ascending: false });

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }
    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) {
      // Table might not exist yet, fallback to app_settings
      records = await getRequestsFromSettings();
    } else {
      records = (data || []).map((r: CustomerUnlockRequestRecord) => ({
        ...r,
        customer_name: r.customers?.shop_name || r.customer_name || "Unknown Customer",
      }));
    }
  } catch {
    records = await getRequestsFromSettings();
  }

  // Apply in-memory filters for fallback
  if (filters?.customerId) {
    records = records.filter((r) => r.customer_id === filters.customerId);
  }
  if (filters?.status && filters.status !== "all") {
    records = records.filter((r) => r.status === filters.status);
  }

  // Check and mark expired records
  let hasExpiredUpdates = false;
  for (const r of records) {
    if (r.status === "approved" && r.expires_at) {
      if (new Date(r.expires_at) < now) {
        r.status = "expired";
        hasExpiredUpdates = true;
      }
    }
  }

  if (hasExpiredUpdates) {
    try {
      // Background update in DB
      for (const r of records.filter((x) => x.status === "expired")) {
        await supabaseAdmin
          .from("customer_unlock_requests")
          .update({ status: "expired" })
          .eq("id", r.id);
      }
    } catch {}
  }

  return records;
}

/**
 * Create a new unlock request from a Rep or Distribution user.
 */
export async function createCustomerUnlockRequest(params: {
  customerId: string;
  customerName?: string;
  requestedBy?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  requestedByRole?: string;
  unlockType: CustomerUnlockType;
  reason: string;
  overdueDetails?: Record<string, unknown> | null;
}): Promise<CustomerUnlockRequestRecord> {
  const newRecord: CustomerUnlockRequestRecord = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cur-${Date.now()}`,
    customer_id: params.customerId,
    customer_name: params.customerName || "Customer",
    requested_by: params.requestedBy || null,
    requested_by_name: params.requestedByName || "Sales Rep",
    requested_by_email: params.requestedByEmail || null,
    requested_by_role: params.requestedByRole || "rep",
    unlock_type: params.unlockType || "one_time",
    reason: params.reason,
    status: "pending",
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    expires_at: null,
    used_at: null,
    used_in_invoice_id: null,
    overdue_details: params.overdueDetails || null,
    admin_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Try dedicated table
  try {
    const { data, error } = await supabaseAdmin
      .from("customer_unlock_requests")
      .insert({
        id: newRecord.id,
        customer_id: newRecord.customer_id,
        customer_name: newRecord.customer_name,
        requested_by: newRecord.requested_by,
        requested_by_name: newRecord.requested_by_name,
        requested_by_email: newRecord.requested_by_email,
        requested_by_role: newRecord.requested_by_role,
        unlock_type: newRecord.unlock_type,
        reason: newRecord.reason,
        status: newRecord.status,
        overdue_details: newRecord.overdue_details,
      })
      .select()
      .single();

    if (!error && data) {
      return data as CustomerUnlockRequestRecord;
    }
  } catch (err) {
    console.warn("customer_unlock_requests insert error, falling back to app_settings:", err);
  }

  // Fallback to app_settings
  const existing = await getRequestsFromSettings();
  const updated = [newRecord, ...existing];
  await saveRequestsToSettings(updated);

  return newRecord;
}

/**
 * Approve or Reject an unlock request (Admin action).
 */
export async function updateCustomerUnlockRequestStatus(params: {
  requestId: string;
  action: "approve" | "reject";
  unlockType?: CustomerUnlockType;
  durationDays?: number;
  adminId?: string;
  adminName?: string;
  adminNotes?: string;
}): Promise<CustomerUnlockRequestRecord> {
  const now = new Date();
  let expiresAt: string | null = null;

  const targetType = params.unlockType || "one_time";

  if (params.action === "approve") {
    if (targetType === "one_time") {
      // 48 hours to create the 1 invoice
      expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    } else if (targetType === "7_days" || params.durationDays === 7) {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (targetType === "14_days" || params.durationDays === 14) {
      expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const updateFields = {
    status: params.action === "approve" ? ("approved" as CustomerUnlockStatus) : ("rejected" as CustomerUnlockStatus),
    unlock_type: targetType,
    approved_by: params.adminId || null,
    approved_by_name: params.adminName || "Admin",
    approved_at: params.action === "approve" ? now.toISOString() : null,
    expires_at: expiresAt,
    admin_notes: params.adminNotes || null,
    updated_at: now.toISOString(),
  };

  // Try DB table update
  try {
    const { data, error } = await supabaseAdmin
      .from("customer_unlock_requests")
      .update(updateFields)
      .eq("id", params.requestId)
      .select()
      .single();

    if (!error && data) {
      return data as CustomerUnlockRequestRecord;
    }
  } catch (err) {
    console.warn("customer_unlock_requests update error, falling back to app_settings:", err);
  }

  // Fallback to app_settings
  const existing = await getRequestsFromSettings();
  const idx = existing.findIndex((r) => r.id === params.requestId);
  if (idx === -1) {
    throw new Error("Unlock request not found");
  }

  existing[idx] = {
    ...existing[idx],
    ...updateFields,
  };

  await saveRequestsToSettings(existing);
  return existing[idx];
}

/**
 * Mark a one-time unlock request as used when an invoice is successfully created.
 */
export async function markCustomerUnlockAsUsed(unlockId: string, invoiceId: string): Promise<void> {
  const updateFields = {
    status: "used" as CustomerUnlockStatus,
    used_at: new Date().toISOString(),
    used_in_invoice_id: invoiceId,
    updated_at: new Date().toISOString(),
  };

  try {
    await supabaseAdmin
      .from("customer_unlock_requests")
      .update(updateFields)
      .eq("id", unlockId);
  } catch {}

  try {
    const existing = await getRequestsFromSettings();
    const idx = existing.findIndex((r) => r.id === unlockId);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updateFields };
      await saveRequestsToSettings(existing);
    }
  } catch {}
}

/**
 * Automatically unblock customer if all 60+ days invoices are settled by payment.
 */
export async function checkAndAutoUnblockCustomer(customerId: string): Promise<{ unblocked: boolean }> {
  try {
    const status = await checkCustomerOverdueStatus(customerId);
    if (!status.hasOverdue) {
      // No 60+ days overdue bills remaining!
      // If customer is marked Blocked, update to Active
      if (status.customerStatus === "Blocked") {
        await supabaseAdmin
          .from("customers")
          .update({
            status: "Active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerId);
      }

      // Mark any pending unlock requests for this customer as resolved
      try {
        await supabaseAdmin
          .from("customer_unlock_requests")
          .update({
            status: "resolved",
            admin_notes: "Auto-unblocked: Overdue invoices settled by payment.",
            updated_at: new Date().toISOString(),
          })
          .eq("customer_id", customerId)
          .eq("status", "pending");
      } catch {}

      try {
        const existing = await getRequestsFromSettings();
        let changed = false;
        existing.forEach((r) => {
          if (r.customer_id === customerId && r.status === "pending") {
            r.status = "resolved";
            r.admin_notes = "Auto-unblocked: Overdue invoices settled by payment.";
            changed = true;
          }
        });
        if (changed) await saveRequestsToSettings(existing);
      } catch {}

      return { unblocked: true };
    }
  } catch (err) {
    console.error("checkAndAutoUnblockCustomer error:", err);
  }
  return { unblocked: false };
}
