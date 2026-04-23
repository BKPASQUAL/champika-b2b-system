import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Edit,
  Trash2,
  Phone,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Building2,
  Users,
} from "lucide-react";
import { Customer, SortField, SortOrder, CustomerStatus } from "../types";
import { TablePagination } from "@/components/ui/TablePagination";
import { BUSINESS_THEMES } from "@/app/config/business-constants";

interface CustomerTableProps {
  customers: Customer[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const STATUS_BORDER: Record<CustomerStatus, string> = {
  Active: "border-l-green-400",
  Inactive: "border-l-gray-300",
  Blocked: "border-l-red-400",
};

export function CustomerTable({
  customers,
  loading,
  sortField,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: CustomerTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  const renderStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
          </span>
        );
      case "Inactive":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <XCircle className="w-3 h-3 mr-1" /> Inactive
          </span>
        );
      case "Blocked":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
            <AlertOctagon className="w-3 h-3 mr-1" /> Blocked
          </span>
        );
    }
  };

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
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">No customers found</p>
          </div>
        ) : (
          customers.map((customer) => {
            const theme = BUSINESS_THEMES[customer.businessId as keyof typeof BUSINESS_THEMES];
            const borderColor = STATUS_BORDER[customer.status] ?? "border-l-gray-300";
            return (
              <Card key={customer.id} className={`overflow-hidden border-l-4 ${borderColor} shadow-sm`}>
                <CardContent className="p-0">
                  {/* Header strip */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className={`h-7 w-7 shrink-0 ${theme?.bgClass || "bg-gray-100"} ${theme?.textClass || "text-gray-600"}`}>
                        <AvatarFallback className="text-[10px] font-bold">
                          {customer.shopName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-sm truncate">{customer.shopName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderStatusBadge(customer.status)}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-3 py-2.5 space-y-2">
                    {/* Contact row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </span>
                      {customer.ownerName && (
                        <span className="truncate">{customer.ownerName}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {customer.route}
                      </span>
                    </div>

                    {/* Business badge */}
                    {customer.businessName && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${theme?.bgClass || "bg-gray-100"} ${theme?.textClass || "text-gray-600"}`}>
                        <Building2 className="w-3 h-3" /> {customer.businessName}
                      </span>
                    )}

                    {/* Balance grid */}
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/40 p-2">
                      <div className="flex flex-col items-center text-center gap-0.5">
                        <span className="text-[10px] text-muted-foreground">Outstanding</span>
                        <span className={`text-xs font-bold ${customer.outstandingBalance > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          LKR {customer.outstandingBalance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col items-center text-center gap-0.5 border-l border-border/50">
                        <span className="text-[10px] text-muted-foreground">Credit Limit</span>
                        <span className="text-xs font-semibold">
                          LKR {customer.creditLimit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="border-t px-3 py-1.5 flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(customer)} title="Edit">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDelete(customer)} title="Delete">
                      <Trash2 className="w-4 h-4 text-destructive" />
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
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("shopName")}>
                <div className="flex items-center">Customer {getSortIcon("shopName")}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("businessName")}>
                <div className="flex items-center">Business {getSortIcon("businessName")}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("route")}>
                <div className="flex items-center">Route / Area {getSortIcon("route")}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("status")}>
                <div className="flex items-center">Status {getSortIcon("status")}</div>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => onSort("outstandingBalance")}>
                <div className="flex items-center justify-end">Balance (LKR) {getSortIcon("outstandingBalance")}</div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                const theme = BUSINESS_THEMES[customer.businessId as keyof typeof BUSINESS_THEMES];
                return (
                  <TableRow key={customer.id} className={theme?.bgClass?.replace("-100", "-50") || ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className={`h-9 w-9 ${theme?.bgClass || "bg-gray-100"} ${theme?.textClass || "text-gray-600"}`}>
                          <AvatarFallback>{customer.shopName.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{customer.shopName}</span>
                          <div className="text-xs text-muted-foreground flex flex-col">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {customer.phone}
                            </span>
                            {customer.ownerName && <span>{customer.ownerName}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${theme?.bgClass || "bg-gray-100"} ${theme?.textClass || "text-gray-600"}`}>
                        <Building2 className="w-3 h-3" /> {customer.businessName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 mr-1" /> {customer.route}
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(customer.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={customer.outstandingBalance > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                          {customer.outstandingBalance.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Limit: {customer.creditLimit.toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(customer)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => onDelete(customer)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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
