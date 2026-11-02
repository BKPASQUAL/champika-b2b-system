"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { WhatsAppShareDialog } from "@/components/ui/WhatsAppShareDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Wallet,
  AlertTriangle,
  Landmark,
  Undo2,
  Share2,
  Copy,
  ExternalLink,
  MessageCircle,
  Eye,
  Phone,
  MapPin,
  CheckCircle2,
  UserSearch,
  FileText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import type { CustomerAccount } from "@/lib/customer-account";
import { downloadCustomerStatement, shareCustomerStatement } from "@/lib/customer-statement-report";

type AccountResponse = CustomerAccount & { shareToken: string };
type Cheque = CustomerAccount["cheques"][number];

const lkr = (n: number) =>
  "LKR " + (n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

// Days since the invoice date
function invoiceAge(date: string) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86400000));
}

function agingBadge(days: number) {
  if (days < 30) return <Badge variant="outline" className="text-gray-700 border-gray-300 whitespace-nowrap">{days} days</Badge>;
  if (days >= 90) return <Badge className="bg-red-600 text-white border-none whitespace-nowrap">{days} days</Badge>;
  if (days >= 60) return <Badge className="bg-orange-500 text-white border-none whitespace-nowrap">{days} days</Badge>;
  return <Badge className="bg-yellow-500 text-white border-none whitespace-nowrap">{days} days</Badge>;
}

function chequeBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "returned" || s === "bounced")
    return <Badge className="bg-red-600 text-white border-none">Returned</Badge>;
  if (s === "deposited") return <Badge className="bg-blue-600 text-white border-none">Deposited</Badge>;
  return <Badge className="bg-amber-500 text-white border-none">Pending</Badge>;
}

function CustomerAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<{ id: string; name: string; info?: string }[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerId, setCustomerId] = useState<string>(searchParams.get("customer") || "");
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Load customers this rep has created bills for
  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("currentUser");
        const user = stored ? JSON.parse(stored) : null;
        if (!user?.id) {
          toast.error("User not found. Please log in again.");
          return;
        }
        const res = await fetch(`/api/customers?repId=${user.id}&billedOnly=true`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCustomers(
          (data || []).map((c: any) => ({
            id: c.id,
            name: c.shopName || c.shop_name || "Unnamed",
            info: [c.ownerName || c.owner_name, c.phone, c.route].filter(Boolean).join(" · "),
          }))
        );
      } catch {
        toast.error("Failed to load customers");
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  // Load selected customer's account
  useEffect(() => {
    if (!customerId) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    setLoadingAccount(true);
    fetch(`/api/customers/${customerId}/account`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        return res.json();
      })
      .then((data) => !cancelled && setAccount(data))
      .catch((e) => !cancelled && toast.error(e.message || "Failed to load customer account"))
      .finally(() => !cancelled && setLoadingAccount(false));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const shareUrl = useMemo(() => {
    if (!account || typeof window === "undefined") return "";
    return `${window.location.origin}/statement/${account.shareToken}`;
  }, [account]);

  const shareMessage = useMemo(() => {
    if (!account) return "";
    const s = account.summary;
    const lines = [
      `*${account.customer.businessName}*`,
      `Account summary for *${account.customer.shopName}*`,
      ``,
      `Outstanding: *${lkr(s.totalOutstanding)}* (${s.unpaidCount} invoice${s.unpaidCount === 1 ? "" : "s"})`,
    ];
    if (s.overdueAmount > 0) lines.push(`Overdue: ${lkr(s.overdueAmount)}`);
    if (s.pendingChequeCount > 0)
      lines.push(`Pending cheques: ${lkr(s.pendingChequeAmount)} (${s.pendingChequeCount})`);
    if (s.returnedChequeCount > 0)
      lines.push(`Returned cheques: ${lkr(s.returnedChequeAmount)} (${s.returnedChequeCount})`);
    lines.push(``, `View full details:`, shareUrl, ``, `Thank you.`);
    return lines.join("\n");
  }, [account, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Account summary", text: shareMessage });
      } catch {
        /* user cancelled */
      }
    } else {
      setShareOpen(true);
    }
  };

  const s = account?.summary;

  // Upcoming cheques: not yet cleared/returned, dated today or later (soonest first)
  const upcomingCheques = useMemo(() => {
    if (!account) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return account.cheques.filter((c) => {
      const st = c.status.toLowerCase();
      if (st !== "pending" && st !== "deposited") return false;
      if (!c.chequeDate) return false;
      const d = new Date(c.chequeDate);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
  }, [account]);

  const returnedCheques = useMemo(
    () =>
      (account?.cheques || []).filter((c) => {
        const st = c.status.toLowerCase();
        return (st === "returned" || st === "bounced") && !c.settled;
      }),
    [account]
  );

  // Same PDF "Customer Outstanding Statement" used on the payments pages
  const statementArgs = (): Parameters<typeof shareCustomerStatement> | null => {
    if (!account) return null;
    if (account.statementInvoices.length === 0) {
      toast.info("No outstanding invoices to put on a statement");
      return null;
    }
    return [account.customer.shopName, account.statementInvoices, account.customer.businessName];
  };
  const shareStatement = async () => {
    const args = statementArgs();
    if (args) await shareCustomerStatement(...args);
  };
  const downloadStatement = () => {
    const args = statementArgs();
    if (args) downloadCustomerStatement(...args);
  };

  const totalReturned = returnedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalUpcoming = upcomingCheques.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-blue-900">Customer Account</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Pick a customer to see unpaid invoices, cheques and payments — then share it with them.
        </p>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-6">
          <SearchableDropdown
            options={customers}
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              router.replace(`/dashboard/rep/customer-account?customer=${id}`);
            }}
            placeholder={loadingCustomers ? "Loading customers..." : "Search customer by shop, owner or phone..."}
            disabled={loadingCustomers}
          />
        </CardContent>
      </Card>

      {!customerId && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center">
          <UserSearch className="h-10 w-10" />
          <p className="text-sm">Select a customer to view their account.</p>
        </div>
      )}

      {loadingAccount && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {account && s && !loadingAccount && (
        <>
          {/* Customer header + share */}
          <Card>
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold leading-snug wrap-break-word">
                  {account.customer.shopName}
                </h2>
                {account.customer.ownerName && (
                  <p className="text-sm text-muted-foreground">{account.customer.ownerName}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                  {account.customer.phone && (
                    <a href={`tel:${account.customer.phone}`} className="flex items-center gap-1 hover:text-blue-700">
                      <Phone className="h-3 w-3" /> {account.customer.phone}
                    </a>
                  )}
                  {account.customer.address && (
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="wrap-break-word">{account.customer.address}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:flex lg:flex-wrap lg:justify-end lg:shrink-0 lg:max-w-xl">
                <Button
                  className="bg-blue-700 hover:bg-blue-800 text-white gap-1.5 w-full lg:w-auto"
                  onClick={shareStatement}
                >
                  <FileText className="h-4 w-4" /> Share Statement
                </Button>
                <Button variant="outline" className="gap-1.5 w-full lg:w-auto" onClick={downloadStatement}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 w-full lg:w-auto"
                  onClick={() => setShareOpen(true)}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
                <Button variant="outline" className="gap-1.5 w-full lg:w-auto" onClick={nativeShare}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <Button variant="outline" className="gap-1.5 w-full lg:w-auto" onClick={copyLink}>
                  <Copy className="h-4 w-4" /> Copy link
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 w-full lg:w-auto"
                  onClick={() => window.open(shareUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" /> Preview
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Outstanding"
              value={lkr(s.totalOutstanding)}
              note={`${s.unpaidCount} unpaid invoices`}
              icon={<Wallet className="w-4 h-4 text-blue-500 shrink-0" />}
              border="border-l-blue-500"
            />
            <StatCard
              title="Overdue"
              value={lkr(s.overdueAmount)}
              note={`${s.overdueCount} past due date`}
              icon={<AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
              border="border-l-red-500"
              valueClass="text-red-700"
            />
            <StatCard
              title="Upcoming Cheques"
              value={lkr(totalUpcoming)}
              note={`${upcomingCheques.length} from today on`}
              icon={<Landmark className="w-4 h-4 text-amber-500 shrink-0" />}
              border="border-l-amber-500"
              valueClass="text-amber-700"
            />
            <StatCard
              title="Returned Cheques"
              value={lkr(totalReturned)}
              note={`${returnedCheques.length} not settled`}
              icon={<Undo2 className="w-4 h-4 text-rose-600 shrink-0" />}
              border="border-l-rose-600"
              valueClass="text-rose-700"
            />
          </div>

          {/* Unpaid invoices */}
          <Section title="Unpaid Invoices" count={account.unpaidInvoices.length}>
            {account.unpaidInvoices.length === 0 ? (
              <Empty icon={<CheckCircle2 className="h-8 w-8 text-green-500" />} text="No unpaid invoices." />
            ) : (
              <>
                {/* Phone & tablet: cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
                  {account.unpaidInvoices.map((inv) => (
                    <div key={inv.id} className="rounded-lg border p-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold break-all">{inv.invoiceNo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(inv.date)} · Due {fmtDate(inv.dueDate)}
                          </p>
                        </div>
                        {agingBadge(invoiceAge(inv.date))}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <div className="min-w-0">
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium wrap-break-word">{lkr(inv.totalAmount)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-muted-foreground">Paid</p>
                          <p className="font-medium text-green-700 wrap-break-word">{lkr(inv.paidAmount)}</p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-muted-foreground">Balance</p>
                          <p className="font-bold text-red-600 wrap-break-word">{lkr(inv.dueAmount)}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3 h-8 text-xs gap-1"
                        onClick={() => router.push(`/dashboard/rep/invoices/${inv.id}`)}
                      >
                        <Eye className="w-3 h-3" /> View Invoice
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden lg:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-center">Aging</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {account.unpaidInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-sm font-medium">{inv.invoiceNo}</TableCell>
                          <TableCell className="text-sm">{fmtDate(inv.date)}</TableCell>
                          <TableCell className="text-sm">{fmtDate(inv.dueDate)}</TableCell>
                          <TableCell className="text-center">{agingBadge(invoiceAge(inv.date))}</TableCell>
                          <TableCell className="text-right text-sm">{lkr(inv.totalAmount)}</TableCell>
                          <TableCell className="text-right text-sm text-green-700">{lkr(inv.paidAmount)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600">{lkr(inv.dueAmount)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => router.push(`/dashboard/rep/invoices/${inv.id}`)}
                            >
                              <Eye className="w-3 h-3" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Section>

          {/* Upcoming cheques */}
          <Section title="Upcoming Cheques" count={upcomingCheques.length}>
            {upcomingCheques.length === 0 ? (
              <Empty text="No upcoming cheques." />
            ) : (
              <ChequeList cheques={upcomingCheques} showStatus />
            )}
          </Section>

          {/* Returned cheques — only shown when the customer has any */}
          {returnedCheques.length > 0 && (
            <Section
              title="Returned Cheques (Not Settled)"
              count={returnedCheques.length}
              danger
              icon={<Undo2 className="h-4 w-4" />}
            >
              <ChequeList cheques={returnedCheques} danger />
              <div className="flex items-center justify-between mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <span className="text-sm font-semibold">Total Returned</span>
                <span className="font-bold text-red-700">{lkr(totalReturned)}</span>
              </div>
            </Section>
          )}

          {/* Recent payments */}
          <Section title="Recent Payments" count={account.recentPayments.length}>
            {account.recentPayments.length === 0 ? (
              <Empty text="No payments yet." />
            ) : (
              <>
                {/* Phone & tablet portrait: cards */}
                <div className="grid gap-2 sm:grid-cols-2 md:hidden">
                  {account.recentPayments.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 flex items-start justify-between gap-3 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{p.method.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 wrap-break-word">
                          {fmtDate(p.date)} · Inv {p.invoiceNo}
                          {p.receiptNo || p.chequeNo ? ` · ${p.receiptNo || p.chequeNo}` : ""}
                        </p>
                      </div>
                      <p className="font-bold text-green-700 shrink-0 text-sm">{lkr(p.amount)}</p>
                    </div>
                  ))}
                </div>

                {/* Tablet landscape & desktop: table */}
                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Receipt / Cheque</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {account.recentPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{fmtDate(p.date)}</TableCell>
                          <TableCell className="text-sm capitalize">{p.method.replace("_", " ")}</TableCell>
                          <TableCell className="font-mono text-sm">{p.receiptNo || p.chequeNo || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{p.invoiceNo}</TableCell>
                          <TableCell className="text-right font-semibold text-green-700">{lkr(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Section>

          <WhatsAppShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            phone={account.customer.phone}
            message={shareMessage}
            title="Share account with customer"
          />
        </>
      )}
    </div>
  );
}

// ── Small layout pieces ─────────────────────────────────────────────────

function StatCard({
  title,
  value,
  note,
  icon,
  border,
  valueClass = "",
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  border: string;
  valueClass?: string;
}) {
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">{title}</p>
          {icon}
        </div>
        <p className={`text-base sm:text-xl xl:text-2xl font-bold mt-1.5 wrap-break-word ${valueClass}`}>{value}</p>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{note}</p>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  count,
  danger,
  icon,
  children,
}: {
  title: string;
  count?: number;
  danger?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={danger ? "border-red-200" : ""}>
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
        <CardTitle className={`text-base flex items-center gap-2 ${danger ? "text-red-700" : ""}`}>
          {icon}
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs font-medium">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground text-center">
      {icon}
      {text}
    </div>
  );
}

function ChequeList({
  cheques,
  showStatus,
  danger,
}: {
  cheques: Cheque[];
  showStatus?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      {/* Phone & tablet portrait: cards */}
      <div className="grid gap-2 sm:grid-cols-2 md:hidden">
        {cheques.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border p-3 ${danger ? "border-red-200 bg-red-50/40" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-sm font-semibold break-all">{c.chequeNo}</p>
              {showStatus && chequeBadge(c.status)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 wrap-break-word">
              {c.bankName ? `${c.bankName} · ` : ""}
              {fmtDate(c.chequeDate)} · Inv {c.invoiceNo}
            </p>
            <p className={`font-bold text-right mt-1 ${danger ? "text-red-600" : ""}`}>{lkr(c.amount)}</p>
          </div>
        ))}
      </div>

      {/* Tablet landscape & desktop: table */}
      <div className={`hidden md:block rounded-md border ${danger ? "border-red-200" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow className={danger ? "bg-red-50" : "bg-muted/50"}>
              <TableHead>Cheque No</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Cheque Date</TableHead>
              <TableHead>Invoice</TableHead>
              {showStatus && <TableHead className="text-center">Status</TableHead>}
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cheques.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">{c.chequeNo}</TableCell>
                <TableCell className="text-sm">{c.bankName || "-"}</TableCell>
                <TableCell className="text-sm">{fmtDate(c.chequeDate)}</TableCell>
                <TableCell className="font-mono text-sm">{c.invoiceNo}</TableCell>
                {showStatus && <TableCell className="text-center">{chequeBadge(c.status)}</TableCell>}
                <TableCell className={`text-right ${danger ? "text-red-600 font-bold" : "font-semibold"}`}>
                  {lkr(c.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function RepCustomerAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CustomerAccountContent />
    </Suspense>
  );
}
