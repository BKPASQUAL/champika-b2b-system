// app/dashboard/office/distribution/products/_components/ProductFilters.tsx
"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Eye, EyeOff } from "lucide-react";

interface ProductFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  subCategoryFilter: string;
  setSubCategoryFilter: (val: string) => void;
  supplierFilter: string;
  setSupplierFilter: (val: string) => void;
  stockFilter: string;
  setStockFilter: (val: string) => void;
  categories: string[];
  subCategories: string[];
  suppliers: string[];
  showCost: boolean;
  onToggleCost: () => void;
}

export function ProductFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  subCategoryFilter,
  setSubCategoryFilter,
  supplierFilter,
  setSupplierFilter,
  stockFilter,
  setStockFilter,
  categories,
  subCategories,
  suppliers,
  showCost,
  onToggleCost,
}: ProductFiltersProps) {
  return (
    <>
      {/* Mobile: stacked (search full-width, then 2+2+1 grid) */}
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
          <Select
            value={subCategoryFilter}
            onValueChange={setSubCategoryFilter}
            disabled={subCategories.length <= 1}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={subCategories.length <= 1 ? "No Sub Categories" : "Sub Category"} />
            </SelectTrigger>
            <SelectContent>
              {subCategories.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {sub === "all" ? "All Sub Categories" : sub}
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
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onToggleCost} className="gap-1.5 text-xs h-9 col-span-2">
            {showCost ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showCost ? "Hide Cost" : "Show Cost"}
          </Button>
        </div>
      </div>

      {/* Desktop: responsive flex wrap */}
      <div className="hidden md:flex md:flex-wrap xl:flex-nowrap md:items-center md:gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full h-9 text-xs"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32 lg:w-36 h-9 text-xs">
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
        <Select
          value={subCategoryFilter}
          onValueChange={setSubCategoryFilter}
          disabled={subCategories.length <= 1}
        >
          <SelectTrigger className="w-32 lg:w-36 h-9 text-xs">
            <SelectValue placeholder={subCategories.length <= 1 ? "No Sub Category" : "Sub Category"} />
          </SelectTrigger>
          <SelectContent>
            {subCategories.map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub === "all" ? "All Sub Categories" : sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-32 lg:w-36 h-9 text-xs">
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
          <SelectTrigger className="w-28 lg:w-[130px] h-9 text-xs">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onToggleCost} className="gap-1.5 text-xs h-9 shrink-0">
          {showCost ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showCost ? "Hide Cost" : "Show Cost"}
        </Button>
      </div>
    </>
  );
}
