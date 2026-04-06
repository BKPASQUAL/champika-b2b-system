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
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Calendar,
  Package,
  User,
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
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const renderStatusBadge = (status: OrderStatus) => {
    const styles: Record<OrderStatus, string> = {
      Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Processing: "bg-blue-100 text-blue-700 border-blue-200",
      Checking: "bg-purple-100 text-purple-700 border-purple-200",
      Loading: "bg-indigo-100 text-indigo-700 border-indigo-200",
      "In Transit": "bg-orange-100 text-orange-700 border-orange-200",
      Delivered: "bg-green-100 text-green-700 border-green-200",
      Cancelled: "bg-red-100 text-red-700 border-red-200",
      Completed: "bg-gray-100 text-gray-700 border-gray-200",
    };

    return (
      <Badge
        variant="outline"
        className={`${
          styles[status] || "bg-gray-100 text-gray-700"
        } border px-2 py-0.5`}
      >
        {status}
      </Badge>
    );
  };

  const orderActions = (order: Order) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onView(order)}>
          <Eye className="mr-2 h-4 w-4" /> View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Move to...</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Processing")}>
          Processing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Checking")}>
          Checking
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateStatus(order, "Loading")}>
          Loading
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onUpdateStatus(order, "Cancelled")}
          className="text-red-600"
        >
          Cancel Order
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const pagination = orders.length > 0 && (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile / Small-tablet card list (hidden on md+) ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No orders found</p>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Card header row */}
                <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                  <span className="font-mono text-xs font-semibold">
                    {order.invoiceNo || order.orderId}
                  </span>
                  <div className="flex items-center gap-1">
                    {renderStatusBadge(order.status)}
                    {orderActions(order)}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-2">
                  {/* Shop / Customer */}
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-semibold leading-tight">{order.shopName}</p>
                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                    </div>
                  </div>

                  {/* Date + Items + Total */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" /> Date
                      </span>
                      <span className="text-xs font-medium">
                        {new Date(order.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="w-3 h-3" /> Items
                      </span>
                      <span className="text-xs font-medium">{order.itemCount}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="text-xs font-bold text-primary">
                        LKR {order.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* View button */}
                <div className="border-t px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => onView(order)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {pagination}
      </div>

      {/* ── Desktop table (hidden below md) ── */}
      <div className="hidden md:block">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  onClick={() => onSort("date")}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center">
                    Date {getSortIcon("date")}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => onSort("invoiceNo")}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center">
                    Invoice No {getSortIcon("invoiceNo")}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => onSort("customerName")}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center">
                    Customer {getSortIcon("customerName")}
                  </div>
                </TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead
                  onClick={() => onSort("totalAmount")}
                  className="text-right cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center justify-end">
                    Total {getSortIcon("totalAmount")}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => onSort("status")}
                  className="text-center cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center justify-center">
                    Status {getSortIcon("status")}
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(order.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium font-mono text-xs">
                      {order.invoiceNo || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{order.shopName}</span>
                        <span className="text-xs text-muted-foreground">{order.customerName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{order.itemCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      LKR {order.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {renderStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {orderActions(order)}
                    </TableCell>
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
