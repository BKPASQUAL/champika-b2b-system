import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, ChevronsUpDown, Lock } from "lucide-react";
import { Expense, ExpenseCategory, ExpenseFormData } from "../types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  initialData?: Expense | null;
  isLoadLocked?: boolean;
}

// 1. ✅ DEFINE THE LOAD INTERFACE
interface Load {
  id: string;
  load_id: string; // API returns snake_case
  loading_date: string; // API returns snake_case
  lorry_number: string; // API returns snake_case
}

const CATEGORIES: ExpenseCategory[] = [
  "Fuel",
  "Maintenance",
  "Services",
  "Delivery",
  "Lunch",
  "Breakfast",
  "Dinner",
  "Guest",
  "Foods",
];

const PAYMENT_METHODS = ["Cash", "Card", "Transfer", "Cheque"];

export function ExpenseFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoadLocked = false,
}: ExpenseFormDialogProps) {
  const [loading, setLoading] = useState(false);

  // 2. ✅ FIX: TYPE THE STATE AS Load[]
  const [loads, setLoads] = useState<Load[]>([]);
  const [openLoadSelect, setOpenLoadSelect] = useState(false);

  const [formData, setFormData] = useState<ExpenseFormData>({
    description: "",
    amount: "",
    category: "Fuel",
    expenseDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    referenceNo: "",
    loadId: "",
  });

  useEffect(() => {
    if (open) {
      fetch("/api/expenses/loads")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setLoads(data);
          } else {
            setLoads([]);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch loads", err);
          setLoads([]);
        });
    }
  }, [open]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        description: initialData.description || "",
        amount: initialData.amount,
        category: initialData.category as ExpenseCategory,
        expenseDate: initialData.expenseDate,
        paymentMethod: initialData.paymentMethod,
        referenceNo: initialData.referenceNo || "",
        loadId: initialData.loadId || "",
      });
    } else {
      setFormData({
        description: "",
        amount: "",
        category: "Fuel",
        expenseDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Cash",
        referenceNo: "",
        loadId: initialData?.loadId || "", // Preserve locked load ID
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      toast.error("Please enter an amount");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getLoadDisplayText = () => {
    if (!formData.loadId) return "Select delivery load...";
    const found = loads.find((load) => load.id === formData.loadId);

    // 3. ✅ FIX: USE CORRECT PROPERTY (load_id)
    if (found) return found.load_id;

    if (isLoadLocked && formData.loadId) return "Current Load (Linked)";
    return "Selected Load";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] overflow-visible">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Edit Expense" : "Add New Expense"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(val) =>
                  setFormData({ ...formData, category: val as ExpenseCategory })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (LKR)</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || "",
                  })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2 flex flex-col">
            <Label className="flex items-center justify-between">
              Linked Delivery
              {isLoadLocked && (
                <span className="text-xs text-muted-foreground flex items-center">
                  <Lock className="w-3 h-3 mr-1" /> Locked to current load
                </span>
              )}
            </Label>

            <Popover
              open={openLoadSelect && !isLoadLocked}
              onOpenChange={setOpenLoadSelect}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openLoadSelect}
                  className={cn(
                    "w-full justify-between",
                    isLoadLocked && "opacity-80 bg-muted cursor-not-allowed"
                  )}
                  disabled={isLoadLocked}
                >
                  {getLoadDisplayText()}
                  {!isLoadLocked && (
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0">
                <Command>
                  <CommandInput placeholder="Search load ID..." />
                  <CommandList>
                    <CommandEmpty>No recent loads found.</CommandEmpty>
                    <CommandGroup>
                      {loads.map((load) => (
                        <CommandItem
                          key={load.id}
                          // 4. ✅ FIX: USE CORRECT PROPERTY (load_id)
                          value={load.load_id}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              loadId:
                                load.id === formData.loadId ? "" : load.id,
                            });
                            setOpenLoadSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.loadId === load.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            {/* 5. ✅ FIX: USE CORRECT PROPERTY (load_id) */}
                            <span className="font-medium">{load.load_id}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(load.loading_date).toLocaleDateString()}{" "}
                              - {load.lorry_number}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="e.g. Diesel for Lorry NB-1234"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.expenseDate}
                onChange={(e) =>
                  setFormData({ ...formData, expenseDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(val) =>
                  setFormData({ ...formData, paymentMethod: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reference No. (Optional)</Label>
            <Input
              value={formData.referenceNo}
              onChange={(e) =>
                setFormData({ ...formData, referenceNo: e.target.value })
              }
              placeholder="e.g. Bill #559"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {initialData?.id ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
