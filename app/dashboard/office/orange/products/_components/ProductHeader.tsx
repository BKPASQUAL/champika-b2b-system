// app/dashboard/office/orange/products/_components/ProductHeader.tsx
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
import {
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  Printer,
  SlidersHorizontal,
  DollarSign,
  ClipboardList,
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-900">
          Orange Products
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage exclusive inventory for Orange Agency
        </p>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="border-orange-200 hover:bg-orange-50 text-orange-700 shadow-sm"
            >
              <Download className="w-4 h-4 sm:mr-2 text-orange-600" />
              <span className="hidden sm:inline">Generate Report</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cost & Price Reports
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
                <DropdownMenuItem onClick={onOpenReportDialog} className="cursor-pointer font-medium text-orange-700 bg-orange-50/50">
                  <SlidersHorizontal className="w-4 h-4 mr-2 text-orange-700" /> Custom Report Options...
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={onAddClick}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Orange Product</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </div>
  );
}
