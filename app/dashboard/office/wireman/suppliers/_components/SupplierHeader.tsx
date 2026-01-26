"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Plus, FileSpreadsheet, FileText } from "lucide-react";

interface SupplierHeaderProps {
  onAddClick: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export function SupplierHeader({
  onAddClick,
  onExportExcel,
  onExportPDF,
}: SupplierHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-red-950">
          Suppliers
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage Wireman Agency supplier database
        </p>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" /> Generate Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Export
              to Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPDF}>
              <FileText className="w-4 h-4 mr-2 text-red-600" /> Export to PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onAddClick} className="bg-red-600 hover:bg-red-700">
          <Plus className="w-4 h-4 mr-2" /> Add New Supplier
        </Button>
      </div>
    </div>
  );
}
