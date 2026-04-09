// app/dashboard/admin/products/_components/ProductFilters.tsx
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface ProductFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  supplierFilter: string;
  setSupplierFilter: (val: string) => void;
  stockFilter: string;
  setStockFilter: (val: string) => void;
  categories: string[];
  suppliers: string[];
}

export function ProductFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  supplierFilter,
  setSupplierFilter,
  stockFilter,
  setStockFilter,
  categories,
  suppliers,
}: ProductFiltersProps) {
  return (
    <>
      {/* Mobile: stacked (search full-width, then 2+1 grid) */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier === "all" ? "All Suppliers" : supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-full col-span-2">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop: all in one row */}
      <div className="hidden md:flex md:items-center md:gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === "all" ? "All Categories" : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier} value={supplier}>
                {supplier === "all" ? "All Suppliers" : supplier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
