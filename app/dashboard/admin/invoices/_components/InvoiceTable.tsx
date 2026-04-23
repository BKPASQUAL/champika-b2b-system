import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  Loader2,
  Printer,
  User,
  Truck,
  Eye,
  Building2,
  Calendar,
  FileText,
} from "lucide-react";
import {
  Invoice,
  SortField,
  SortOrder,
  PaymentStatus,
  OrderStatus,
} from "../types";
import { printInvoice } from "../print-utils";
import { BUSINESS_THEMES, BUSINESS_NAMES } from "@/app/config/business-constants";
import { useState } from "react";
import { TablePagination } from "@/components/ui/TablePagination";

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-green-100 text-green-700 border-green-200",
  Unpaid: "bg-red-100 text-red-700 border-red-200",
  Partial: "bg-orange-100 text-orange-700 border-orange-200",
  Overdue: "bg-red-600 text-white border-red-700",
};

const PAYMENT_BORDER: Record<PaymentStatus, string> = {
  Paid: "border-l-green-400",
  Unpaid: "border-l-red-400",
  Partial: "border-l-orange-400",
  Overdue: "border-l-red-700",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  Pending: "bg-yellow-50 text-yellow-800 border-yellow-200",
  Processing: "bg-blue-50 text-blue-800 border-blue-200",
  Checking: "bg-purple-50 text-purple-800 border-purple-200",
  Loading: "bg-indigo-50 text-indigo-800 border-indigo-200",
  "In Transit": "bg-indigo-100 text-indigo-800 border-indigo-200",
  Delivered: "bg-green-50 text-green-800 border-green-200",
  Completed: "bg-gray-100 text-gray-800 border-gray-200",
  Cancelled: "bg-red-50 text-red-800 border-red-200",
};

export function InvoiceTable({
  invoices,
  loading,
  sortField,
  sortOrder,
  onSort,
  onEdit,
  onView,
  currentPage,
  totalPages,
  onPageChange,
}: InvoiceTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    await printInvoice(id);
    setDownloadingId(null);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  const renderPaymentBadge = (status: PaymentStatus) => (
    <Badge variant="outline" className={`${PAYMENT_STYLES[status]} border whitespace-nowrap text-[10px] px-1.5 py-0`}>
      {status}
    </Badge>
  );

  const renderOrderStatusBadge = (status: OrderStatus) => (
    <Badge variant="outline" className={`${ORDER_STATUS_STYLES[status] || "bg-gray-100"} border whitespace-nowrap text-[10px] px-1.5 py-0`}>
      {status}
    </Badge>
  );

  const isLocked = (status: string) =>
    ["Loading", "In Transit", "Delivered", "Completed", "Cancelled"].includes(status);

  const pagination = (
    <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile cards (hidden on md+) ── */}
      <div className="flex flex-col gap-2 md:hidden">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          invoices.map((invoice) => {
            const theme = BUSINESS_THEMES[invoice.businessId as keyof typeof BUSINESS_THEMES];
            const businessName = invoice.businessId
              ? BUSINESS_NAMES[invoice.businessId as keyof typeof BUSINESS_NAMES]
              : null;
            const borderColor = PAYMENT_BORDER[invoice.status] ?? "border-l-gray-300";
            return (
              <Card key={invoice.id} className={`overflow-hidden border-l-4 ${borderColor} shadow-sm ${theme?.bgClass?.replace("-100", "-50") || ""}`}>
                <CardContent className="p-0">
                  {/* Header strip */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs font-semibold truncate">{invoice.invoiceNo}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderPaymentBadge(invoice.status)}
                      {renderOrderStatusBadge(invoice.orderStatus)}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-3 py-2.5 space-y-2">
                    {/* Customer */}
                    <div className="flex items-start gap-2">
                      <div className="rounded-md bg-muted p-1.5 shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{invoice.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{invoice.salesRepName}</p>
                        {businessName && (
                          <span className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${theme?.bgClass || "bg-gray-100"} ${theme?.textClass || "text-gray-600"}`}>
                            <Building2 className="w-2.5 h-2.5" />{businessName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted/40 p-2">
                      <div className="flex flex-col items-center text-center gap-0.5">
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Calendar className="w-3 h-3" /> Date
                        </div>
                        <span className="text-xs font-semibold">
                          {new Date(invoice.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <div className="flex flex-col items-center text-center gap-0.5 border-x border-border/50">
                        <span className="text-[10px] text-muted-foreground">Total</span>
                        <span className="text-xs font-bold text-primary">
                          LKR {invoice.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col items-center text-center gap-0.5">
                        <span className="text-[10px] text-muted-foreground">Due</span>
                        <span className={`text-xs font-bold ${invoice.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          LKR {invoice.dueAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="border-t px-3 py-1.5 flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => onView(invoice.id)} title="View">
                      <Eye className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(invoice.id)}
                      disabled={isLocked(invoice.orderStatus)}
                      title={isLocked(invoice.orderStatus) ? "Locked" : "Edit"}
                    >
                      <Edit className={`w-4 h-4 ${isLocked(invoice.orderStatus) ? "opacity-30" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDownload(invoice.id)}
                      disabled={downloadingId === invoice.id}
                      title="Print"
                    >
                      {downloadingId === invoice.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Printer className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        {pagination}
      </div>

      {/* ── Desktop table (hidden below md) ── */}
      <div className="hidden md:block overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => onSort("date")} className="cursor-pointer hover:bg-muted/50 whitespace-nowrap">
                <div className="flex items-center">Date {getSortIcon("date")}</div>
              </TableHead>
              <TableHead onClick={() => onSort("invoiceNo")} className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center">Invoice # {getSortIcon("invoiceNo")}</div>
              </TableHead>
              <TableHead onClick={() => onSort("customerName")} className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center">Customer {getSortIcon("customerName")}</div>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <div className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Business
                </div>
              </TableHead>
              <TableHead onClick={() => onSort("orderStatus")} className="text-center cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-center">
                  <Truck className="w-3 h-3 mr-1" /> Order {getSortIcon("orderStatus")}
                </div>
              </TableHead>
              <TableHead onClick={() => onSort("status")} className="text-center cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-center">Payment {getSortIcon("status")}</div>
              </TableHead>
              <TableHead onClick={() => onSort("totalAmount")} className="text-right cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-end">Total {getSortIcon("totalAmount")}</div>
              </TableHead>
              <TableHead onClick={() => onSort("dueAmount")} className="text-right cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-end">Due {getSortIcon("dueAmount")}</div>
              </TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => {
                const theme = BUSINESS_THEMES[invoice.businessId as keyof typeof BUSINESS_THEMES];
                const businessName = invoice.businessId
                  ? BUSINESS_NAMES[invoice.businessId as keyof typeof BUSINESS_NAMES]
                  : null;
                return (
                  <TableRow key={invoice.id} className={theme?.bgClass?.replace("-100", "-50") || ""}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                      {new Date(invoice.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{invoice.invoiceNo}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm leading-tight">{invoice.customerName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" /> {invoice.salesRepName}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {businessName ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${theme?.bgClass || "bg-gray-100"} ${theme?.textClass || "text-gray-600"}`}>
                          {businessName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{renderOrderStatusBadge(invoice.orderStatus)}</TableCell>
                    <TableCell className="text-center">{renderPaymentBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                      LKR {invoice.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={invoice.dueAmount > 0 ? "text-red-600 font-semibold text-sm" : "text-muted-foreground text-sm"}>
                        LKR {invoice.dueAmount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => onView(invoice.id)} title="View Details">
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(invoice.id)}
                          disabled={isLocked(invoice.orderStatus)}
                          title={isLocked(invoice.orderStatus) ? "Locked" : "Edit Invoice"}
                        >
                          <Edit className={`w-4 h-4 ${isLocked(invoice.orderStatus) ? "opacity-30" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDownload(invoice.id)}
                          disabled={downloadingId === invoice.id}
                          title="Print Invoice"
                        >
                          {downloadingId === invoice.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Printer className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {pagination}
      </div>
    </>
  );
}
