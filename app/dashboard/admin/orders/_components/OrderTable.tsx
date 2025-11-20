// app/dashboard/admin/orders/_components/OrderTable.tsx
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
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
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
    const styles = {
      Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Processing: "bg-blue-100 text-blue-700 border-blue-200",
      Checking: "bg-purple-100 text-purple-700 border-purple-200",
      Loading: "bg-indigo-100 text-indigo-700 border-indigo-200",
      Delivered: "bg-green-100 text-green-700 border-green-200",
      Cancelled: "bg-red-100 text-red-700 border-red-200",
    };
    return (
      <Badge
        variant="outline"
        className={`${styles[status]} border px-2 py-0.5`}
      >
        {status}
      </Badge>
    );
  };

  return (
    <>
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
                onClick={() => onSort("orderId")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Order ID {getSortIcon("orderId")}
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
                    {order.orderId}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {order.shopName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.customerName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.itemCount}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    LKR {order.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderStatusBadge(order.status)}
                  </TableCell>
                  <TableCell className="text-right">
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
                        <DropdownMenuItem
                          onClick={() => onUpdateStatus(order, "Processing")}
                        >
                          Processing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onUpdateStatus(order, "Checking")}
                        >
                          Checking
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onUpdateStatus(order, "Loading")}
                        >
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {orders.length > 0 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 10 + 1} to{" "}
            {Math.min(currentPage * 10, totalPages * 10)} of {totalPages * 10}{" "}
            entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
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
      )}
    </>
  );
}
