import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Calendar, Search, Filter } from "lucide-react";
import { ExpenseCategory } from "../types";

interface ExpenseFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  month: string;
  setMonth: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  onClear: () => void;
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

export function ExpenseFilters({
  searchQuery,
  setSearchQuery,
  category,
  setCategory,
  month,
  setMonth,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onClear,
}: ExpenseFiltersProps) {
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(e.target.value);
    setStartDate("");
    setEndDate("");
  };

  const handleDateChange = (type: "start" | "end", val: string) => {
    setMonth("");
    if (type === "start") setStartDate(val);
    else setEndDate(val);
  };

  return (
    <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
        <Filter className="w-4 h-4" /> Filter Options
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <span className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none">
            <Calendar className="w-4 h-4" />
          </span>
          <Input
            type="month"
            value={month}
            onChange={handleMonthChange}
            className="pl-9"
            title="Filter by Month"
          />
        </div>

        <div className="flex gap-2 col-span-1 lg:col-span-2">
          <Input
            type="date"
            placeholder="From"
            value={startDate}
            onChange={(e) => handleDateChange("start", e.target.value)}
            className="w-full"
            title="Start Date"
          />
          <span className="py-2 text-muted-foreground">-</span>
          <Input
            type="date"
            placeholder="To"
            value={endDate}
            onChange={(e) => handleDateChange("end", e.target.value)}
            className="w-full"
            title="End Date"
          />
          {(searchQuery ||
            category !== "ALL" ||
            month ||
            startDate ||
            endDate) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" /> Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
