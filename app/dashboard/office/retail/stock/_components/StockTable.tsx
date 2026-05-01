// app/dashboard/office/retail/stock/_components/StockTable.tsx
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
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  Package,
  Layers,
  AlertTriangle,
  Split,
  ShoppingBag,
} from "lucide-react";

// Define the type here or import it if you have a shared types file
export interface RetailStockItem {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  retail_price?: number | null;
  retail_only?: boolean;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
  category: string;
}

export type SortField = "name" | "stock_quantity" | "selling_price";
export type SortOrder = "asc" | "desc";

interface StockTableProps {
  items: RetailStockItem[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDivideStock?: (item: RetailStockItem) => void;
}

export function StockTable({
  items,
  loading,
  sortField,
  sortOrder,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  onDivideStock,
}: StockTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[40%]"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center">
                  Product Details {getSortIcon("name")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50 w-[20%]"
                onClick={() => onSort("selling_price")}
              >
                <div className="flex items-center justify-end">
                  Price (LKR) {getSortIcon("selling_price")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50 w-[15%]"
                onClick={() => onSort("stock_quantity")}
              >
                <div className="flex items-center justify-end">
                   Stock Level {getSortIcon("stock_quantity")}
                </div>
              </TableHead>
              <TableHead className="text-center w-[15%]">Status</TableHead>
              <TableHead className="text-center w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="group hover:bg-muted/50">
                  {/* Product Name & SKU */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 bg-blue-100 text-blue-700 border border-blue-200">
                        <AvatarFallback className="font-semibold">
                          {item.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700 transition-colors">
                            {item.name}
                          </span>
                          {item.retail_only && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                              <ShoppingBag className="w-2.5 h-2.5 mr-0.5" /> Retail
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono bg-muted px-1 rounded">
                            {item.sku}
                          </span>
                          {item.category && (
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" /> {item.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Price */}
                  <TableCell className="text-right">
                    {item.retail_price ? (
                      <div>
                        <div className="font-semibold text-purple-700">
                          {Number(item.retail_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Retail Price</div>
                      </div>
                    ) : (
                      <div className="font-medium">
                        {item.selling_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </TableCell>

                  {/* Stock Quantity */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm">
                        {item.stock_quantity}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {item.unit_of_measure}
                      </span>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center">
                    {item.stock_quantity <= 0 ? (
                      <Badge
                        variant="destructive"
                        className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                      >
                        Out of Stock
                      </Badge>
                    ) : item.stock_quantity < 10 ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" /> Low Stock
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200"
                      >
                        In Stock
                      </Badge>
                    )}
                  </TableCell>
                  
                  {/* Actions */}
                  <TableCell className="text-center">
                    {onDivideStock && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDivideStock(item)}
                        className="text-xs flex items-center h-8"
                        disabled={item.stock_quantity <= 0}
                      >
                        <Split className="w-3 h-3 mr-1" /> Divide
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
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
