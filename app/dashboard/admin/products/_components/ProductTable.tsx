// app/dashboard/admin/products/_components/ProductTable.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  Building2,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Product, SortField, SortOrder } from "../types";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ProductTable({
  products,
  loading,
  sortField,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: ProductTableProps) {
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
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading products...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center">
                  Product Name {getSortIcon("name")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("category")}
              >
                <div className="flex items-center">
                  Category {getSortIcon("category")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("supplier")}
              >
                <div className="flex items-center">
                  Supplier {getSortIcon("supplier")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("stock")}
              >
                <div className="flex items-center justify-end">
                  Stock {getSortIcon("stock")}
                </div>
              </TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("sellingPrice")}
              >
                <div className="flex items-center justify-end">
                  Selling Price {getSortIcon("sellingPrice")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("mrp")}
              >
                <div className="flex items-center justify-end">
                  MRP {getSortIcon("mrp")}
                </div>
              </TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {product.name}
                      {product.stock === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Out of
                          Stock
                        </span>
                      ) : product.stock < product.minStock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Low Stock
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Tag className="w-3 h-3 mr-1" /> {product.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Building2 className="w-3 h-3 mr-1" /> {product.supplier}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        product.stock === 0
                          ? "text-red-600 font-bold"
                          : product.stock < product.minStock
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {product.stock} {product.unitOfMeasure} 
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      Min: {product.minStock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    LKR {product.costPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    LKR {product.sellingPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    LKR {product.mrp.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    LKR {product.totalCost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          (window.location.href = `/products/${product.id}`)
                        }
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(product)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && products.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t ">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 7 + 1} to{" "}
            {Math.min(currentPage * 7, totalPages * 7)} of {totalPages * 7}{" "}
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
            <div className="flex items-center gap-1">
              <Button variant="default" size="sm" className="w-9">
                {currentPage}
              </Button>
            </div>
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
