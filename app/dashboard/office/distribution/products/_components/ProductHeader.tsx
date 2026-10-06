// app/dashboard/office/distribution/products/_components/ProductHeader.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  Printer,
  SlidersHorizontal,
  DollarSign,
  ClipboardList,
  Boxes,
} from "lucide-react";

interface ProductHeaderProps {
  onAddClick: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onPriceListReport: () => void;
  onPrintPriceListReport?: () => void;
  onCostPriceDownload?: () => void;
  onCostPricePrint?: () => void;
  onOpenReportDialog?: () => void;
}

export function ProductHeader({
  onAddClick,
  onExportExcel,
  onExportPDF,
  onPriceListReport,
  onPrintPriceListReport,
  onCostPriceDownload,
  onCostPricePrint,
  onOpenReportDialog,
}: ProductHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground mt-1">
          Manage products and inventory for Champika B2B
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/dashboard/office/distribution/products/matrix">
          <Button variant="outline" className="shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50">
            <Boxes className="w-4 h-4 mr-2 text-blue-600" /> Matrix Generator
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="shadow-sm">
              <Download className="w-4 h-4 mr-2 text-blue-600" /> Generate Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cost & Price Reports (By Supplier)
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={onCostPricePrint} className="cursor-pointer">
              <Printer className="w-4 h-4 mr-2 text-blue-600" /> Print Cost & Price Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCostPriceDownload} className="cursor-pointer">
              <Download className="w-4 h-4 mr-2 text-blue-600" /> Download Cost Report (PDF)
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Selling Price List (Customer)
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={onPrintPriceListReport} className="cursor-pointer">
              <Printer className="w-4 h-4 mr-2 text-emerald-600" /> Print Price List
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPriceListReport} className="cursor-pointer">
              <ClipboardList className="w-4 h-4 mr-2 text-emerald-600" /> Download Price List (PDF)
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Export to Excel (.xlsx)
            </DropdownMenuItem>
            {onOpenReportDialog && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenReportDialog} className="cursor-pointer font-medium text-blue-700 bg-blue-50/50">
                  <SlidersHorizontal className="w-4 h-4 mr-2 text-blue-700" /> Custom Report Options...
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={onAddClick}>
          <Plus className="w-4 h-4 mr-2" /> Add New Product
        </Button>
      </div>
    </div>
  );
}
