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
  Eye,
  MoreHorizontal,
  Calendar,
  Package,
  User,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Order, SortField, SortOrder, OrderStatus } from "../types";
import { TablePagination } from "@/components/ui/TablePagination";

interface OrderTableProps {
  orders: Order[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView: (order: Order) => void;
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
}

const STATUS_STYLES: Record<OrderStatus, { badge: string; border: string }> = {
  Pending:     { badge: "bg-yellow-100 text-yellow-700 border-yellow-200",  border: "border-l-yellow-400" },
  Processing:  { badge: "bg-blue-100 text-blue-700 border-blue-200",        border: "border-l-blue-400" },
  Checking:    { badge: "bg-purple-100 text-purple-700 border-purple-200",  border: "border-l-purple-400" },
  Loading:     { badge: "bg-indigo-100 text-indigo-700 border-indigo-200",  border: "border-l-indigo-400" },
  "In Transit":{ badge: "bg-orange-100 text-orange-700 border-orange-200",  border: "border-l-orange-400" },
  Delivered:   { badge: "bg-green-100 text-green-700 border-green-200",     border: "border-l-green-400" },
  Cancelled:   { badge: "bg-red-100 text-red-700 border-red-200",           border: "border-l-red-400" },
  Completed:   { badge: "bg-gray-100 text-gray-700 border-gray-200",        border: "border-l-gray-400" },
};

export function OrderTable({
  orders,
  sortField,
  sortOrder,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  onView,
  onUpdateStatus,
}: OrderTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1" />
    );
  };

  const renderStatusBadge = (status: OrderStatus) => (
    <Badge
      variant="outline"
      className={`${STATUS_STYLES[status]?.badge ?? "bg-gray-100 text-gray-700"} border text-xs px-2 py-0.5 font-medium`}
    >
      {status}
    </Badge>
  );

  const orderActions = (order: Order) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onView(order)}>
          <Eye className="mr-2 h-4 w-4" /> View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Move to…</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Processing")}>Processing</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Checking")}>Checking</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Loading")}>Loading</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Cancelled")} className="text-red-600">
          Cancel Order
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const pagination = orders.length > 0 && (
    <TablePagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );

  return (
    <>
      {/* ── Mobile / Small-tablet card list (hidden on md+) ── */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm">No orders found</p>
          </div>
        ) : (
          orders.map((order) => {
            const borderColor = STATUS_STYLES[order.status]?.border ?? "border-l-gray-400";
            return (
              <Card
                key={order.id}
                className={`overflow-hidden border-l-4 ${borderColor} transition-shadow hover:shadow-md`}
              >
                <CardContent className="p-0">
                  {/* Top row: invoice + status + menu */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs font-semibold truncate">
                        {order.invoiceNo || order.orderId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {renderStatusBadge(order.status)}
                      {orderActions(order)}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-3 py-2.5 space-y-2.5">
                    {/* Shop / Customer */}
                    <div className="flex items-start gap-2">
                      <div className="rounded-md bg-muted p-1.5 shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{order.shopName}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.customerName}</p>
                      </div>
                    </div>

                    {/* Date / Items / Total */}
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2">
                      <div className="flex flex-col gap-0.5 items-center text-center">
                        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>Date</span>
                        </div>
                        <span className="text-xs font-semibold">
                          {new Date(order.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-center text-center border-x border-border/50">
                        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Package className="w-3 h-3" />
                          <span>Items</span>
                        </div>
                        <span className="text-xs font-semibold">{order.itemCount}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-center text-center">
                        <span className="text-xs text-muted-foreground">Total</span>
                        <span className="text-xs font-bold text-primary">
                          LKR {order.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="border-t px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs gap-1.5 hover:bg-muted"
                      onClick={() => onView(order)}
                    >
                      <Eye className="w-3.5 h-3.5" /> View Details
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
      <div className="hidden md:block">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead
                  onClick={() => onSort("date")}
                  className="cursor-pointer hover:bg-muted/70 text-xs font-semibold uppercase tracking-wide"
                >
                  <div className="flex items-center">Date {getSortIcon("date")}</div>
                </TableHead>
                <TableHead
                  onClick={() => onSort("invoiceNo")}
                  className="cursor-pointer hover:bg-muted/70 text-xs font-semibold uppercase tracking-wide"
                >
                  <div className="flex items-center">Invoice No {getSortIcon("invoiceNo")}</div>
                </TableHead>
                <TableHead
                  onClick={() => onSort("customerName")}
                  className="cursor-pointer hover:bg-muted/70 text-xs font-semibold uppercase tracking-wide"
                >
                  <div className="flex items-center">Customer {getSortIcon("customerName")}</div>
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Items</TableHead>
                <TableHead
                  onClick={() => onSort("totalAmount")}
                  className="text-right cursor-pointer hover:bg-muted/70 text-xs font-semibold uppercase tracking-wide"
                >
                  <div className="flex items-center justify-end">Total {getSortIcon("totalAmount")}</div>
                </TableHead>
                <TableHead
                  onClick={() => onSort("status")}
                  className="text-center cursor-pointer hover:bg-muted/70 text-xs font-semibold uppercase tracking-wide"
                >
                  <div className="flex items-center justify-center">Status {getSortIcon("status")}</div>
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No orders found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, i) => (
                  <TableRow
                    key={order.id}
                    className={`hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(order.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">
                        {order.invoiceNo || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm leading-tight">{order.shopName}</span>
                        <span className="text-xs text-muted-foreground">{order.customerName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">{order.itemCount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold">
                        LKR {order.totalAmount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{renderStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">{orderActions(order)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {pagination}
      </div>
    </>
  );
}
