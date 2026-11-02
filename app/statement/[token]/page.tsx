// Public, read-only customer account page opened from a link the rep shares.
// The token is signed (see lib/customer-account.ts) and expires after 30 days.
import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerAccount, verifyShareToken } from "@/lib/customer-account";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Summary",
  robots: { index: false, follow: false },
};

const lkr = (n: number) =>
  "LKR " + (n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

function LinkProblem({ text }: { text: string }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm text-center bg-white rounded-xl border p-8 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">Link not available</h1>
        <p className="text-sm text-gray-500 mt-2">{text}</p>
      </div>
    </main>
  );
}

export default async function StatementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customerId = verifyShareToken(token);
  if (!customerId) {
    return <LinkProblem text="This link is invalid or has expired. Please ask your sales representative for a new one." />;
  }

  const account = await getCustomerAccount(customerId);
  if (!account) return <LinkProblem text="Account not found." />;

  const { customer, summary: s, unpaidInvoices, recentPayments } = account;
  // Hide returned cheques that were already settled
  const cheques = account.cheques.filter((c) => !c.settled);

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-blue-900 text-white rounded-xl p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-blue-200">{customer.businessName}</p>
          <h1 className="text-xl font-bold mt-1">{customer.shopName}</h1>
          {customer.ownerName && <p className="text-sm text-blue-100">{customer.ownerName}</p>}
          <p className="text-xs text-blue-200 mt-3">
            Account summary as of {fmtDate(account.generatedAt)}
          </p>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border p-4 col-span-2">
            <p className="text-xs text-gray-500">Total amount due</p>
            <p className="text-2xl font-bold text-gray-900">{lkr(s.totalOutstanding)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {s.unpaidCount} unpaid invoice{s.unpaidCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Overdue</p>
            <p className="text-lg font-bold text-red-700">{lkr(s.overdueAmount)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Cheques pending</p>
            <p className="text-lg font-bold text-amber-700">{lkr(s.pendingChequeAmount)}</p>
          </div>
          {s.returnedChequeCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 col-span-2">
              <p className="text-sm font-semibold text-red-800">
                {s.returnedChequeCount} returned cheque{s.returnedChequeCount === 1 ? "" : "s"} —{" "}
                {lkr(s.returnedChequeAmount)}
              </p>
              <p className="text-xs text-red-700 mt-0.5">Please arrange a replacement payment.</p>
            </div>
          )}
        </div>

        {/* Unpaid invoices */}
        <section className="bg-white rounded-xl border overflow-hidden">
          <h2 className="px-4 py-3 border-b font-semibold text-gray-800">Unpaid Invoices</h2>
          {unpaidInvoices.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">No unpaid invoices. Thank you!</p>
          ) : (
            <ul className="divide-y">
              {unpaidInvoices.map((inv) => (
                <li key={inv.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/invoice/${inv.id}`} className="font-mono text-sm font-semibold text-blue-700 underline">
                      {inv.invoiceNo}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtDate(inv.date)} · Due {fmtDate(inv.dueDate)}
                    </p>
                    {inv.daysOverdue > 0 && (
                      <span className="inline-block mt-1 text-[11px] font-medium rounded px-1.5 py-0.5 bg-red-100 text-red-700">
                        {inv.daysOverdue} days overdue
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{lkr(inv.dueAmount)}</p>
                    {inv.paidAmount > 0 && (
                      <p className="text-[11px] text-gray-500">of {lkr(inv.totalAmount)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Cheques */}
        {cheques.length > 0 && (
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="px-4 py-3 border-b font-semibold text-gray-800">Cheques</h2>
            <ul className="divide-y">
              {cheques.map((c) => {
                const st = c.status.toLowerCase();
                const returned = st === "returned" || st === "bounced";
                return (
                  <li key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">#{c.chequeNo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.bankName ? `${c.bankName} · ` : ""}
                        {fmtDate(c.chequeDate)} · Inv {c.invoiceNo}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{lkr(c.amount)}</p>
                      <span
                        className={`inline-block mt-1 text-[11px] font-medium rounded px-1.5 py-0.5 ${
                          returned
                            ? "bg-red-100 text-red-700"
                            : st === "deposited"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {returned ? "Returned" : st === "deposited" ? "Deposited" : "Pending"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Recent payments */}
        {recentPayments.length > 0 && (
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="px-4 py-3 border-b font-semibold text-gray-800">Recent Payments</h2>
            <ul className="divide-y">
              {recentPayments.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">{p.method.replace("_", " ")}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtDate(p.date)} · Inv {p.invoiceNo}
                      {p.receiptNo ? ` · Rcpt ${p.receiptNo}` : ""}
                    </p>
                  </div>
                  <p className="font-bold text-green-700 shrink-0">{lkr(p.amount)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          If anything looks wrong, please contact your sales representative.
        </p>
      </div>
    </main>
  );
}
