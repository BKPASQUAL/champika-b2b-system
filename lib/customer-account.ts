// Customer account summary: unpaid invoices, cheques and recent payments.
// Used by the rep "Customer Account" page and the public shared customer page.
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { StatementInvoice } from "@/lib/customer-statement-report";

export interface AccountInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  daysOverdue: number; // 0 when not yet due
}

export interface AccountCheque {
  id: string;
  chequeNo: string;
  chequeDate: string | null;
  bankName: string | null;
  amount: number;
  status: string; // Pending | Deposited | Passed | Returned
  invoiceNo: string;
  // Returned cheques only: true once the invoice it was for is fully paid again
  settled: boolean;
}

export interface AccountPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  receiptNo: string | null;
  chequeNo: string | null;
  invoiceNo: string;
}

export interface CustomerAccount {
  customer: {
    id: string;
    shopName: string;
    ownerName: string;
    phone: string;
    address: string;
    businessName: string;
    creditLimit: number;
  };
  summary: {
    totalOutstanding: number;
    unpaidCount: number;
    overdueAmount: number;
    overdueCount: number;
    pendingChequeAmount: number;
    pendingChequeCount: number;
    returnedChequeAmount: number;
    returnedChequeCount: number;
    netAfterPendingCheques: number;
  };
  unpaidInvoices: AccountInvoice[];
  cheques: AccountCheque[]; // pending, deposited and returned cheques
  recentPayments: AccountPayment[];
  // Rows for the PDF "Customer Outstanding Statement" (lib/customer-statement-report.ts)
  statementInvoices: StatementInvoice[];
  generatedAt: string;
}

const PENDING_CHEQUE = ["pending", "deposited"];
const RETURNED_CHEQUE = ["returned", "bounced"];

export async function getCustomerAccount(customerId: string): Promise<CustomerAccount | null> {
  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name, owner_name, phone, address, credit_limit, businesses(name)")
    .eq("id", customerId)
    .single();

  if (error || !customer) return null;

  // Invoices for this customer (only delivered orders count as owed)
  const { data: invoiceRows = [] } = await supabaseAdmin
    .from("invoices")
    .select(
      "id, invoice_no, manual_invoice_no, total_amount, paid_amount, due_amount, status, due_date, created_at, is_incorrect, orders(order_date, status)"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allInvoices = invoiceRows || [];
  const invoiceNoMap: Record<string, string> = {};
  allInvoices.forEach((inv: any) => {
    invoiceNoMap[inv.id] = inv.manual_invoice_no || inv.invoice_no;
  });

  const unpaidInvoices: AccountInvoice[] = allInvoices
    .filter((inv: any) => {
      const order = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
      const status = String(inv.status || "").toLowerCase();
      if (status.includes("cancel") || status === "paid") return false;
      if (inv.is_incorrect) return false;
      if (order?.status !== "Delivered") return false;
      return Number(inv.due_amount) > 0;
    })
    .map((inv: any) => {
      const order = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
      let daysOverdue = 0;
      if (inv.due_date) {
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        daysOverdue = Math.max(0, Math.round((today.getTime() - due.getTime()) / 86400000));
      }
      return {
        id: inv.id,
        invoiceNo: inv.manual_invoice_no || inv.invoice_no,
        date: order?.order_date || inv.created_at,
        dueDate: inv.due_date,
        totalAmount: Number(inv.total_amount) || 0,
        paidAmount: Number(inv.paid_amount) || 0,
        dueAmount: Number(inv.due_amount) || 0,
        status: inv.status || "Unpaid",
        daysOverdue,
      };
    });

  // Payments: direct to customer, or against any of the customer's invoices
  const invoiceIds = allInvoices.map((i: any) => i.id);
  const paymentSelect =
    "id, invoice_id, amount, method, payment_date, created_at, receipt_number, cheque_no, cheque_date, cheque_status, is_cancelled, bank_codes(bank_name, bank_code)";

  const { data: directPayments = [] } = await supabaseAdmin
    .from("payments")
    .select(paymentSelect)
    .eq("customer_id", customerId);

  let invoicePayments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await supabaseAdmin.from("payments").select(paymentSelect).in("invoice_id", invoiceIds);
    invoicePayments = data || [];
  }

  const paymentMap = new Map<string, any>();
  [...(directPayments || []), ...invoicePayments].forEach((p: any) => paymentMap.set(p.id, p));
  const payments = Array.from(paymentMap.values()).filter((p) => !p.is_cancelled);

  // A returned cheque is reversed off its invoice, so it is "not settled"
  // while that invoice still has a balance.
  const unpaidIds = new Set(unpaidInvoices.map((i) => i.id));
  const isReturned = (p: any) => RETURNED_CHEQUE.includes(String(p.cheque_status || "").toLowerCase());

  const cheques: AccountCheque[] = payments
    .filter((p) => p.method === "cheque" || p.cheque_no)
    .map((p) => {
      const bank = Array.isArray(p.bank_codes) ? p.bank_codes[0] : p.bank_codes;
      return {
        id: p.id,
        chequeNo: p.cheque_no || "N/A",
        chequeDate: p.cheque_date || null,
        bankName: bank?.bank_name || null,
        amount: Number(p.amount) || 0,
        status: p.cheque_status || "Pending",
        invoiceNo: (p.invoice_id && invoiceNoMap[p.invoice_id]) || "-",
        settled: isReturned(p) && !!p.invoice_id && !unpaidIds.has(p.invoice_id),
      };
    })
    .filter((c) => {
      const s = c.status.toLowerCase();
      return PENDING_CHEQUE.includes(s) || RETURNED_CHEQUE.includes(s);
    })
    .sort((a, b) => String(a.chequeDate || "").localeCompare(String(b.chequeDate || "")));

  const recentPayments: AccountPayment[] = payments
    .map((p) => ({
      id: p.id,
      date: p.payment_date || p.created_at,
      amount: Number(p.amount) || 0,
      method: p.method || "cash",
      receiptNo: p.receipt_number || null,
      chequeNo: p.cheque_no || null,
      invoiceNo: (p.invoice_id && invoiceNoMap[p.invoice_id]) || "-",
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 15);

  const sum = (arr: { amount?: number; dueAmount?: number }[], key: "amount" | "dueAmount") =>
    arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);

  const overdue = unpaidInvoices.filter((i) => i.daysOverdue > 0);
  const pendingCheques = cheques.filter((c) => PENDING_CHEQUE.includes(c.status.toLowerCase()));
  const returnedCheques = cheques.filter(
    (c) => RETURNED_CHEQUE.includes(c.status.toLowerCase()) && !c.settled
  );
  const totalOutstanding = sum(unpaidInvoices, "dueAmount");
  const pendingChequeAmount = sum(pendingCheques, "amount");

  const business: any = Array.isArray(customer.businesses) ? customer.businesses[0] : customer.businesses;

  // ── Statement rows ────────────────────────────────────────────────────
  // Unpaid invoices with all their payments (so not-settled returned cheques
  // show in the "Return Cheques" table), plus invoices paid on the latest
  // payment date (the statement shows these as PAID). Returned cheques on
  // paid invoices are settled, so they are left out.
  const toRecord = (p: any) => {
    const bank = Array.isArray(p.bank_codes) ? p.bank_codes[0] : p.bank_codes;
    return {
      id: p.id,
      paymentDate: p.payment_date || p.created_at,
      chequeDate: p.cheque_date || null,
      amount: Number(p.amount) || 0,
      method: p.method || "cash",
      receiptNumber: p.receipt_number || null,
      chequeNo: p.cheque_no || null,
      chequeStatus: p.cheque_status || null,
      bankName: bank?.bank_name || null,
      bankCode: bank?.bank_code || null,
    };
  };

  const paymentsByInvoice = new Map<string, any[]>();
  payments.forEach((p) => {
    if (!p.invoice_id) return;
    if (!paymentsByInvoice.has(p.invoice_id)) paymentsByInvoice.set(p.invoice_id, []);
    paymentsByInvoice.get(p.invoice_id)!.push(p);
  });

  const latestPayDay = payments
    .filter((p) => !isReturned(p) && p.invoice_id)
    .map((p) => String(p.payment_date || p.created_at || "").split("T")[0])
    .sort()
    .pop();

  const statementInvoices: StatementInvoice[] = [];
  allInvoices.forEach((inv: any) => {
    const order = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
    const status = String(inv.status || "").toLowerCase();
    if (status.includes("cancel") || inv.is_incorrect || order?.status !== "Delivered") return;

    const invPayments = paymentsByInvoice.get(inv.id) || [];
    const isUnpaid = unpaidIds.has(inv.id);
    const paidOnLatestDay =
      !isUnpaid &&
      !!latestPayDay &&
      invPayments.some(
        (p) => !isReturned(p) && String(p.payment_date || p.created_at || "").split("T")[0] === latestPayDay
      );
    if (!isUnpaid && !paidOnLatestDay) return;

    statementInvoices.push({
      id: inv.id,
      invoiceNo: inv.manual_invoice_no || inv.invoice_no,
      date: order?.order_date || inv.created_at,
      totalAmount: Number(inv.total_amount) || 0,
      paidAmount: Number(inv.paid_amount) || 0,
      balance: isUnpaid ? Number(inv.due_amount) || 0 : 0,
      status: isUnpaid ? inv.status || "Unpaid" : "Paid",
      payments: (isUnpaid ? invPayments : invPayments.filter((p) => !isReturned(p))).map(toRecord),
    });
  });
  statementInvoices.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    customer: {
      id: customer.id,
      shopName: customer.shop_name,
      ownerName: customer.owner_name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      businessName: business?.name || "Champika Hardware",
      creditLimit: Number(customer.credit_limit) || 0,
    },
    summary: {
      totalOutstanding,
      unpaidCount: unpaidInvoices.length,
      overdueAmount: sum(overdue, "dueAmount"),
      overdueCount: overdue.length,
      pendingChequeAmount,
      pendingChequeCount: pendingCheques.length,
      returnedChequeAmount: sum(returnedCheques, "amount"),
      returnedChequeCount: returnedCheques.length,
      netAfterPendingCheques: Math.max(0, totalOutstanding - pendingChequeAmount),
    },
    unpaidInvoices,
    cheques,
    recentPayments,
    statementInvoices,
    generatedAt: new Date().toISOString(),
  };
}

// ── Share links ──────────────────────────────────────────────────────────
// A share link carries the customer id + expiry, signed with a server secret,
// so customers can't guess other customers' links.

const SHARE_LINK_DAYS = 30;

function shareSecret() {
  return process.env.CUSTOMER_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-share-secret";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", shareSecret()).update(payload).digest("base64url").slice(0, 22);
}

export function createShareToken(customerId: string) {
  const expires = Math.floor(Date.now() / 1000) + SHARE_LINK_DAYS * 86400;
  const payload = Buffer.from(`${customerId}.${expires}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the customer id if the token is valid and not expired, else null. */
export function verifyShareToken(token: string): string | null {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  const [customerId, expires] = Buffer.from(payload, "base64url").toString().split(".");
  if (!customerId || !expires || Number(expires) * 1000 < Date.now()) return null;
  return customerId;
}
