import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Plus, FileSpreadsheet, FileText } from "lucide-react";

interface ProductHeaderProps {
  onAddClick: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export function ProductHeader({
  onAddClick,
  onExportExcel,
  onExportPDF,
}: ProductHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-orange-900">
          Orange Products
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage exclusive inventory for Orange Agency
        </p>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="border-orange-200 hover:bg-orange-50 text-orange-700"
            >
              <Download className="w-4 h-4 mr-2" /> Reports
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Export
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPDF}>
              <FileText className="w-4 h-4 mr-2 text-red-600" /> Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          onClick={onAddClick}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Orange Product
        </Button>
      </div>
    </div>
  );
}
