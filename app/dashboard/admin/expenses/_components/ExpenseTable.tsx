import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  Calendar,
  CreditCard,
  Truck,
  Building2,
  Globe,
} from "lucide-react";
import { Expense } from "../types";

interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseTable({
  expenses,
  onEdit,
  onDelete,
}: ExpenseTableProps) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {/* Comments removed from here to prevent hydration error */}
            <TableHead>Business</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Delivery / Load</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center py-8 text-muted-foreground"
              >
                No expenses found
              </TableCell>
            </TableRow>
          ) : (
            expenses.map((expense) => (
              <TableRow key={expense.id}>
                {/* Comments removed from direct TableRow children */}
                <TableCell className="font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(expense.expenseDate).toLocaleDateString()}
                  </div>
                </TableCell>

                <TableCell>
                  {expense.businessName && expense.businessName !== "Global" ? (
                    <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-1 rounded-md w-fit text-xs font-medium border border-blue-100">
                      <Building2 className="w-3 h-3" />
                      {expense.businessName}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2 py-1 rounded-md w-fit text-xs font-medium border border-gray-200">
                      <Globe className="w-3 h-3" />
                      Global
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className="bg-slate-50 text-slate-700 border-slate-200"
                  >
                    {expense.category}
                  </Badge>
                </TableCell>

                <TableCell
                  className="max-w-[200px] truncate"
                  title={expense.description}
                >
                  {expense.description || (
                    <span className="text-muted-foreground italic">-</span>
                  )}
                </TableCell>

                <TableCell>
                  {expense.loadRef ? (
                    <Badge variant="secondary" className="font-mono text-xs">
                      <Truck className="w-3 h-3 mr-1" />
                      {expense.loadRef}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {expense.referenceNo || "-"}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <CreditCard className="w-3 h-3 text-muted-foreground" />
                    {expense.paymentMethod}
                  </div>
                </TableCell>

                <TableCell className="text-right font-bold text-red-600">
                  - LKR {expense.amount.toLocaleString()}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(expense)}
                    >
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(expense.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
