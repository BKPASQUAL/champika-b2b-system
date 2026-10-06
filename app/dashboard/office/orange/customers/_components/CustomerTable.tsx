// app/dashboard/office/orange/customers/_components/CustomerTable.tsx
"use client";

import React, { useState } from "react";
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
  Pin,
  FileDown,
  Printer,
  Share2,
} from "lucide-react";
import { Customer, SortField, SortOrder, CustomerStatus } from "../types";
import { INTERNAL_CUSTOMERS } from "@/app/config/business-constants";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  quickDownloadCustomerStatement,
  quickPrintCustomerStatement,
  quickShareCustomerStatement,
} from "@/app/lib/customer-list-report";

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
  agencyTitle?: string;
}

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
  agencyTitle = "Orange Agency",
}: CustomerTableProps) {
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // --- PINNING LOGIC ---
  const pinnedCustomers = customers.filter((c) =>
    INTERNAL_CUSTOMERS.includes(c.shopName),
  );
  const otherCustomers = customers.filter(
    (c) => !INTERNAL_CUSTOMERS.includes(c.shopName),
  );

  const displayCustomers = [...pinnedCustomers, ...otherCustomers];

  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const renderStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
          </span>
        );
      case "Inactive":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <XCircle className="w-3 h-3 mr-1" /> Inactive
          </span>
        );
      case "Blocked":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
            <AlertOctagon className="w-3 h-3 mr-1" /> Blocked
          </span>
        );
      default:
        return status;
    }
  };

  const handleDownloadStatement = async (c: Customer) => {
    setBusyActionId(`pdf-${c.id}`);
    try {
      await quickDownloadCustomerStatement(c.id, c.shopName);
    } finally {
      setBusyActionId(null);
    }
  };

  const handlePrintStatement = async (c: Customer) => {
    setBusyActionId(`print-${c.id}`);
    try {
      await quickPrintCustomerStatement(c.id, c.shopName);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleShareStatement = async (c: Customer) => {
    setBusyActionId(`share-${c.id}`);
    try {
      await quickShareCustomerStatement(c.id, c.shopName, agencyTitle);
    } finally {
      setBusyActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 min-w-[200px]"
                onClick={() => onSort("shopName")}
              >
                <div className="flex items-center">
                  Customer {getSortIcon("shopName")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("route")}
              >
                <div className="flex items-center">
                  Route / Area {getSortIcon("route")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("status")}
              >
                <div className="flex items-center">
                  Status {getSortIcon("status")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50 min-w-[140px]"
                onClick={() => onSort("outstandingBalance")}
              >
                <div className="flex items-center justify-end">
                  Balance (LKR) {getSortIcon("outstandingBalance")}
                </div>
              </TableHead>
              <TableHead className="text-right min-w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              displayCustomers.map((customer) => {
                const isPinned = INTERNAL_CUSTOMERS.includes(customer.shopName);
                const isBusy = busyActionId?.includes(customer.id);
                return (
                  <TableRow
                    key={customer.id}
                    className={isPinned ? "bg-orange-50/50" : ""}
                  >
                    {/* Customer Name & Phone */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 bg-orange-100 text-orange-700">
                          <AvatarFallback>
                            {customer.shopName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm flex items-center gap-2">
                            {customer.shopName}
                            {isPinned && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded">
                                <Pin className="w-2.5 h-2.5 fill-orange-600 text-orange-600 rotate-45" /> Internal
                              </span>
                            )}
                          </span>
                          <div className="text-xs text-muted-foreground flex flex-col">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {customer.phone || "No phone"}
                            </span>
                            {customer.ownerName && (
                              <span>{customer.ownerName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Route */}
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 mr-1" /> {customer.route || "General"}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>{renderStatusBadge(customer.status)}</TableCell>

                    {/* Balance */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={
                            customer.outstandingBalance > 0
                              ? "text-orange-600 font-bold text-sm"
                              : "text-muted-foreground font-medium text-sm"
                          }
                        >
                          {(customer.outstandingBalance || 0).toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Limit: {(customer.creditLimit || 0).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick Statement PDF */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDownloadStatement(customer)}
                          disabled={isBusy}
                          title="Download PDF Statement"
                          className="hover:bg-emerald-50 hover:text-emerald-700 text-emerald-600"
                        >
                          {busyActionId === `pdf-${customer.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5" />
                          )}
                        </Button>

                        {/* Quick Print Statement */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handlePrintStatement(customer)}
                          disabled={isBusy}
                          title="Print Customer Statement"
                          className="hover:bg-blue-50 hover:text-blue-700 text-blue-600"
                        >
                          {busyActionId === `print-${customer.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Printer className="w-3.5 h-3.5" />
                          )}
                        </Button>

                        {/* Quick Share on WhatsApp */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleShareStatement(customer)}
                          disabled={isBusy}
                          title="Share Statement via WhatsApp / Web Share"
                          className="hover:bg-green-50 hover:text-green-700 text-green-600"
                        >
                          {busyActionId === `share-${customer.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </Button>

                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(customer)}
                          title="Edit Customer"
                          className="hover:bg-muted"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDelete(customer)}
                          title="Delete Customer"
                          className="hover:bg-red-50 text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </>
  );
}
