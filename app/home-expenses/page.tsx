"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Fuel,
  GraduationCap,
  ShoppingBag,
  Utensils,
  Wine,
  Home,
  Pill,
  CircleEllipsis,
  Zap,
  Droplet,
  Wifi,
  Phone,
  Flame,
  Salad,
  Key,
  Wrench,
  Sparkles,
  Calendar,
  MapPin,
  FileText,
  DollarSign,
  PlusCircle,
  Trash2,
  ListFilter,
  RefreshCw,
  LineChart,
  Pin,
  PinOff,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

// Expense items definition
interface CategoryOption {
  value: string;
  label: string;
  group: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryOption[] = [
  // User's explicit expenses
  { value: "Fuel Vezzel", label: "Fuel (Vezel)", group: "Transport", icon: Fuel, color: "text-blue-400", bgColor: "bg-blue-950/40" },
  { value: "fulel Wagon r", label: "Fuel (Wagon R)", group: "Transport", icon: Fuel, color: "text-sky-400", bgColor: "bg-sky-950/40" },
  { value: "Nangi baba Tution fees", label: "Nangi Baba Tuition Fees", group: "Education", icon: GraduationCap, color: "text-purple-400", bgColor: "bg-purple-950/40" },
  { value: "Shopping", label: "Shopping", group: "Lifestyle", icon: ShoppingBag, color: "text-pink-400", bgColor: "bg-pink-950/40" },
  { value: "Foods", label: "Foods / Groceries", group: "Food & Drinks", icon: Utensils, color: "text-amber-400", bgColor: "bg-amber-950/40" },
  { value: "Dinner", label: "Dinner Out", group: "Food & Drinks", icon: Utensils, color: "text-orange-400", bgColor: "bg-orange-950/40" },
  { value: "lunch", label: "Lunch", group: "Food & Drinks", icon: Utensils, color: "text-yellow-400", bgColor: "bg-yellow-950/40" },
  { value: "Break fast", label: "Breakfast", group: "Food & Drinks", icon: Utensils, color: "text-lime-400", bgColor: "bg-lime-950/40" },
  { value: "Fish", label: "Fish Market", group: "Food & Drinks", icon: Salad, color: "text-teal-400", bgColor: "bg-teal-950/40" },
  { value: "Chicken", label: "Chicken", group: "Food & Drinks", icon: Salad, color: "text-emerald-400", bgColor: "bg-emerald-950/40" },
  { value: "Liquer", label: "Liquor", group: "Lifestyle", icon: Wine, color: "text-indigo-400", bgColor: "bg-indigo-950/40" },
  { value: "Bites", label: "Bites / Snacks", group: "Food & Drinks", icon: Utensils, color: "text-violet-400", bgColor: "bg-violet-950/40" },
  { value: "House Workets", label: "House Workers (Helper)", group: "Household", icon: Home, color: "text-amber-500", bgColor: "bg-amber-900/20" },
  { value: "Medicses", label: "Medicines / Medicses", group: "Healthcare", icon: Pill, color: "text-red-400", bgColor: "bg-red-950/40" },

  // Normal house expenses added for complete household logging
  { value: "Electricity Bill", label: "Electricity Bill", group: "Utilities", icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-950/30" },
  { value: "Water Bill", label: "Water Bill", group: "Utilities", icon: Droplet, color: "text-cyan-400", bgColor: "bg-cyan-950/40" },
  { value: "Internet Bill", label: "Internet / Wifi Bill", group: "Utilities", icon: Wifi, color: "text-indigo-500", bgColor: "bg-indigo-950/30" },
  { value: "Mobile Bill", label: "Mobile / Phone Bill", group: "Utilities", icon: Phone, color: "text-emerald-500", bgColor: "bg-emerald-950/30" },
  { value: "Cooking Gas", label: "Cooking Gas", group: "Utilities", icon: Flame, color: "text-orange-500", bgColor: "bg-orange-950/30" },
  { value: "Vegetables", label: "Vegetables", group: "Food & Drinks", icon: Salad, color: "text-green-400", bgColor: "bg-green-950/40" },
  { value: "Rent / Lease", label: "Rent / Lease", group: "Household", icon: Key, color: "text-rose-400", bgColor: "bg-rose-950/40" },
  { value: "Vehicle Maintenance", label: "Vehicle Maintenance", group: "Transport", icon: Wrench, color: "text-gray-400", bgColor: "bg-gray-800/40" },
  { value: "Cleaning & Toiletries", label: "Cleaning & Toiletries", group: "Household", icon: Sparkles, color: "text-fuchsia-400", bgColor: "bg-fuchsia-950/40" },
  { value: "Others", label: "Others / Misc", group: "General", icon: CircleEllipsis, color: "text-slate-400", bgColor: "bg-slate-800/40" },
];

interface HomeExpense {
  id: string;
  category: string;
  amount: number;
  place: string;
  expenseDate: string;
  description: string;
  createdAt: string;
}

export default function HomeExpensesPage() {
  const [expenses, setExpenses] = useState<HomeExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Layout context (only shows main dashboard exit link if logged in)
  const [loggedInUser, setLoggedInUser] = useState(false);

  // Tab State: Switches between "log" (Logger Form) and "analytics" (Analytics view)
  const [activeTab, setActiveTab] = useState<"log" | "analytics">("log");

  // Form Fields State
  const [category, setCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");

  // Lock / Pin Fields State (Fixed on submission)
  const [isCategoryLocked, setIsCategoryLocked] = useState(false);
  const [isPlaceLocked, setIsPlaceLocked] = useState(false);
  const [isDateLocked, setIsDateLocked] = useState(true); // Default date to locked (fixed)

  // Custom User Categories List
  const [customCategories, setCustomCategories] = useState<CategoryOption[]>([]);

  // Search inside Category Dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filters / Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState("ALL");

  // Selected Day-by-Day expanded row
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Selected Month expanded row
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    // Force dark mode classes and background styling for this standalone page to prevent white gaps
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    
    const originalHtmlBg = htmlEl.style.backgroundColor;
    const originalBodyBg = bodyEl.style.backgroundColor;
    const originalHtmlColor = htmlEl.style.color;
    const originalBodyColor = bodyEl.style.color;

    htmlEl.classList.add("dark");
    bodyEl.classList.add("dark");
    htmlEl.style.backgroundColor = "#020617";
    bodyEl.style.backgroundColor = "#020617";
    htmlEl.style.color = "#f1f5f9";
    bodyEl.style.color = "#f1f5f9";

    // Check if user is logged in to show B2B Portal exit button
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        setLoggedInUser(true);
      }
    }

    // Set default date to today in local timezone (YYYY-MM-DD)
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - offset * 60 * 1000);
    setExpenseDate(localDate.toISOString().split("T")[0]);

    // Load custom categories from localStorage
    const storedCats = localStorage.getItem("customHomeExpenseCategories");
    if (storedCats) {
      try {
        const parsed = JSON.parse(storedCats);
        const mapped = parsed.map((catName: string) => ({
          value: catName,
          label: catName,
          group: "Custom Categories",
          icon: CircleEllipsis,
          color: "text-indigo-300",
          bgColor: "bg-indigo-950/20",
        }));
        setCustomCategories(mapped);
      } catch (e) {
        console.error("Failed to parse custom categories", e);
      }
    }

    fetchExpenses();

    return () => {
      // Revert dynamic styling when navigating away from this page
      htmlEl.classList.remove("dark");
      bodyEl.classList.remove("dark");
      htmlEl.style.backgroundColor = originalHtmlBg;
      bodyEl.style.backgroundColor = originalBodyBg;
      htmlEl.style.color = originalHtmlColor;
      bodyEl.style.color = originalBodyColor;
    };
  }, []);

  // Click outside to close custom category dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/home-expenses");
      if (!res.ok) throw new Error("Failed to load records");
      const data = await res.json();
      setExpenses(data);
    } catch (error: any) {
      console.error(error);
      toast.error("Error fetching expenses list.");
    } finally {
      setLoading(false);
    }
  };

  const addCustomCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return trimmed;

    // Check if it already exists (case-insensitive)
    const existsInPredefined = CATEGORIES.some(
      (c) => c.value.toLowerCase() === trimmed.toLowerCase()
    );
    const existsInCustom = customCategories.some(
      (c) => c.value.toLowerCase() === trimmed.toLowerCase()
    );

    if (existsInPredefined) {
      const match = CATEGORIES.find((c) => c.value.toLowerCase() === trimmed.toLowerCase());
      return match ? match.value : trimmed;
    }

    if (existsInCustom) {
      const match = customCategories.find((c) => c.value.toLowerCase() === trimmed.toLowerCase());
      return match ? match.value : trimmed;
    }

    // Create a new option
    const newCat: CategoryOption = {
      value: trimmed,
      label: trimmed,
      group: "Custom Categories",
      icon: CircleEllipsis,
      color: "text-indigo-300",
      bgColor: "bg-indigo-950/20",
    };

    const updated = [...customCategories, newCat];
    setCustomCategories(updated);
    
    // Save only string names in localStorage
    const names = updated.map((c) => c.value);
    localStorage.setItem("customHomeExpenseCategories", JSON.stringify(names));
    
    return trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error("Please select a category.");
      return;
    }

    let finalCategory = category;
    if (category === "CREATE_NEW_CATEGORY") {
      const trimmedCustomName = newCategoryName.trim();
      if (!trimmedCustomName) {
        toast.error("Please enter a custom category name.");
        return;
      }
      finalCategory = addCustomCategory(trimmedCustomName);
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/home-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: finalCategory,
          amount: parseFloat(amount),
          place: place.trim(),
          expenseDate,
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Submission failed");
      }

      toast.success("Expense added successfully!");
      
      // Submit success: Reset non-locked fields
      setAmount("");
      setDescription("");
      setNewCategoryName("");

      if (!isCategoryLocked) {
        setCategory("");
      } else {
        setCategory(finalCategory);
      }

      if (!isPlaceLocked) {
        setPlace("");
      }

      if (!isDateLocked) {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localDate = new Date(today.getTime() - offset * 60 * 1000);
        setExpenseDate(localDate.toISOString().split("T")[0]);
      }
      
      fetchExpenses();
    } catch (error: any) {
      toast.error(error.message || "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const res = await fetch(`/api/home-expenses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Expense deleted successfully.");
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    } catch (error: any) {
      toast.error("Failed to delete expense.");
    }
  };

  // Helper to find category metadata
  const getCategoryMeta = (value: string) => {
    const foundPredefined = CATEGORIES.find((c) => c.value === value);
    if (foundPredefined) return foundPredefined;

    const foundCustom = customCategories.find((c) => c.value === value);
    if (foundCustom) return foundCustom;

    return {
      label: value,
      icon: CircleEllipsis,
      color: "text-indigo-400",
      bgColor: "bg-indigo-950/40",
      group: "Custom Categories",
    };
  };

  // Stats calculation
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentMonthPrefix = new Date().toISOString().substring(0, 7); // YYYY-MM

    let todayTotal = 0;
    let monthTotal = 0;
    let allTimeTotal = 0;

    expenses.forEach((e) => {
      allTimeTotal += e.amount;
      if (e.expenseDate === todayStr) {
        todayTotal += e.amount;
      }
      if (e.expenseDate.startsWith(currentMonthPrefix)) {
        monthTotal += e.amount;
      }
    });

    return { todayTotal, monthTotal, allTimeTotal };
  }, [expenses]);

  // Unique groups for filter dropdown
  const groups = useMemo(() => {
    const allGroups = [...CATEGORIES, ...customCategories].map((c) => c.group);
    return ["ALL", ...Array.from(new Set(allGroups))];
  }, [customCategories]);

  // Filtered List for Logger view
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const catObj = [...CATEGORIES, ...customCategories].find((c) => c.value === e.category);
      
      const matchesSearch =
        e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (catObj?.label || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.place.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGroup =
        filterGroup === "ALL" || (catObj && catObj.group === filterGroup);

      return matchesSearch && matchesGroup;
    });
  }, [expenses, searchQuery, filterGroup, customCategories]);

  // Filter categories shown inside the custom dropdown selection
  const filteredCategoriesForSelect = useMemo(() => {
    const all = [...customCategories, ...CATEGORIES];
    if (!categorySearchQuery) return all;
    return all.filter((c) =>
      c.label.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
      c.group.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  }, [customCategories, categorySearchQuery]);

  // Unique groups in search dropdown
  const selectDropdownGroups = useMemo(() => {
    return Array.from(new Set(filteredCategoriesForSelect.map((c) => c.group)));
  }, [filteredCategoriesForSelect]);

  // --- ANALYTICS AGGREGATIONS ---
  
  // 1. Day-by-Day Summary Table Data
  const dailyExpenses = useMemo(() => {
    const dailyMap: Record<string, { date: string; amount: number; count: number; items: HomeExpense[] }> = {};
    
    expenses.forEach((e) => {
      const date = e.expenseDate;
      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          amount: 0,
          count: 0,
          items: [],
        };
      }
      dailyMap[date].amount += e.amount;
      dailyMap[date].count += 1;
      dailyMap[date].items.push(e);
    });

    return Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses]);

  // 2. Category Breakdown Aggregation
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, { category: string; amount: number; count: number }> = {};
    
    expenses.forEach((e) => {
      const cat = e.category;
      if (!catMap[cat]) {
        catMap[cat] = {
          category: cat,
          amount: 0,
          count: 0,
        };
      }
      catMap[cat].amount += e.amount;
      catMap[cat].count += 1;
    });

    return Object.values(catMap).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // 3. Month-by-Month Summary Data
  const monthlyExpenses = useMemo(() => {
    const monthlyMap: Record<string, { monthStr: string; label: string; amount: number; count: number; categoryBreakdown: Record<string, number> }> = {};
    
    expenses.forEach((e) => {
      const monthPrefix = e.expenseDate.substring(0, 7); // YYYY-MM
      if (!monthlyMap[monthPrefix]) {
        const [year, month] = monthPrefix.split("-");
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        const label = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        
        monthlyMap[monthPrefix] = {
          monthStr: monthPrefix,
          label,
          amount: 0,
          count: 0,
          categoryBreakdown: {},
        };
      }
      
      const monthData = monthlyMap[monthPrefix];
      monthData.amount += e.amount;
      monthData.count += 1;
      
      if (!monthData.categoryBreakdown[e.category]) {
        monthData.categoryBreakdown[e.category] = 0;
      }
      monthData.categoryBreakdown[e.category] += e.amount;
    });

    return Object.values(monthlyMap).sort((a, b) => b.monthStr.localeCompare(a.monthStr));
  }, [expenses]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-indigo-600/40 relative overflow-x-hidden w-full max-w-full">
      
      {/* BULLETPROOF BODY AND SCROLL FIXES FOR STANDALONE PWA / MOBILE VIEWS */}
      <style dangerouslySetInnerHTML={{__html: `
        body, html {
          background-color: #020617 !important; /* Forces dark theme on scroll boundaries */
          overflow-x: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
        }
      `}} />

      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full bg-indigo-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] rounded-full bg-violet-900/5 blur-[120px] pointer-events-none" />

      {/* DEDICATED SIDEBAR (Only visible on Desktop/Tablet screen sizes) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800/60 bg-slate-900/40 backdrop-blur-md h-screen sticky top-0 p-5 shrink-0 z-20 justify-between">
        <div className="space-y-6">
          {/* Sidebar Header */}
          <div className="flex items-center gap-3 py-2 border-b border-slate-800/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <LineChart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Home Expenses
              </h1>
              <p className="text-[10px] text-indigo-400 font-semibold">Standalone Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-2">
              Menu
            </span>
            
            <button
              type="button"
              onClick={() => setActiveTab("log")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "log"
                  ? "bg-indigo-600/15 border border-indigo-500/20 text-indigo-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Expense</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-indigo-600/15 border border-indigo-500/20 text-indigo-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer Exit Link */}
        {loggedInUser && (
          <div className="border-t border-slate-800/60 pt-4">
            <Link
              href="/dashboard/office"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-950 border border-slate-850 hover:bg-slate-800/40 active:scale-95 transition-all"
            >
              <span>Exit to Portal</span>
            </Link>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden z-10 relative bg-slate-950">
        
        {/* Mobile Header (Hidden on desktop) */}
        <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center">
              <LineChart className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm text-slate-200">Home Expenses</span>
          </div>
          {loggedInUser && (
            <Link
              href="/dashboard/office"
              className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              Exit
            </Link>
          )}
        </header>

        {/* Dynamic Header on Desktop */}
        <header className="hidden md:flex h-16 border-b border-slate-900 items-center justify-between px-8 flex-shrink-0 z-10">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Home Expenses</span>
            <span>/</span>
            <span className="text-slate-200 capitalize font-medium">{activeTab === "log" ? "Log Expense" : "Analytics"}</span>
          </div>
          {loggedInUser && (
            <Link
              href="/dashboard/office"
              className="text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition-all"
            >
              Go to B2B Dashboard
            </Link>
          )}
        </header>

        {/* Main Panel */}
        <div className="flex-1 p-3 sm:p-6 md:p-8 flex flex-col items-center w-full max-w-full overflow-x-hidden">
          
          {/* Mobile Tabs Switcher */}
          <div className="md:hidden w-full max-w-md bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl flex items-center mb-5 shrink-0">
            <button
              onClick={() => setActiveTab("log")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "log"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>

          {/* Tab Render Switcher */}
          <div className="w-full max-w-md px-0.5 sm:px-0 flex-1">
            {activeTab === "log" ? (
              <>
                {/* Form Card */}
                <div className="w-full bg-slate-900/40 backdrop-blur-xl border border-slate-800/70 rounded-3xl p-5 shadow-2xl mb-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Category Selector Popover */}
                    <div className="space-y-1.5" ref={dropdownRef}>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                          Expense Category <span className="text-rose-500">*</span>
                        </label>
                        
                        {/* Lock Category Toggle */}
                        <button
                          type="button"
                          onClick={() => setIsCategoryLocked(!isCategoryLocked)}
                          className={`text-[10px] flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all active:scale-95 cursor-pointer ${
                            isCategoryLocked
                              ? "text-indigo-400 bg-indigo-950/40 border-indigo-500/30 font-medium"
                              : "text-slate-500 bg-slate-950 border-slate-800/40"
                          }`}
                          title="If fixed, the selected category won't clear on submission"
                        >
                          {isCategoryLocked ? (
                            <>
                              <Pin className="w-3 h-3 text-indigo-400" />
                              <span>Fixed</span>
                            </>
                          ) : (
                            <>
                              <PinOff className="w-3 h-3 text-slate-600" />
                              <span>Auto-Clear</span>
                            </>
                          )}
                        </button>
                      </div>
                      
                      <div className="relative">
                        {/* Trigger */}
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full h-12 rounded-xl bg-slate-900/90 border border-slate-800 px-3 text-sm text-slate-100 flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {category && category !== "CREATE_NEW_CATEGORY" ? (
                              (() => {
                                const meta = getCategoryMeta(category);
                                const Icon = meta.icon;
                                return (
                                  <>
                                    <div className={`w-6 h-6 rounded-lg ${meta.bgColor} flex items-center justify-center border border-slate-800/60`}>
                                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                                    </div>
                                    <span className="font-semibold">{meta.label}</span>
                                  </>
                                );
                              })()
                            ) : category === "CREATE_NEW_CATEGORY" ? (
                              <>
                                <div className="w-6 h-6 rounded-lg bg-indigo-950/40 flex items-center justify-center border border-slate-800/60">
                                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <span className="font-semibold text-indigo-300">Custom Category...</span>
                              </>
                            ) : (
                              <span className="text-slate-500">Select Category</span>
                            )}
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 text-indigo-400" : ""}`} />
                        </button>

                        {/* Popover content */}
                        {isDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-2 animate-in fade-in duration-150 slide-in-from-top-1">
                            
                            <div className="p-1.5 border-b border-slate-800 flex items-center gap-2 mb-1">
                              <input
                                type="text"
                                placeholder="Search categories..."
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                className="w-full h-8 rounded-lg bg-slate-950 border border-slate-850 px-2.5 text-base md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>

                            <div className="max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent py-1 space-y-1">
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setCategory("CREATE_NEW_CATEGORY");
                                  setIsDropdownOpen(false);
                                  setCategorySearchQuery("");
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800/50 transition-all flex items-center gap-2 ${
                                  category === "CREATE_NEW_CATEGORY" ? "text-indigo-300 bg-indigo-950/20" : "text-indigo-400"
                                }`}
                              >
                                <Plus className="w-4 h-4 text-indigo-400" />
                                <span>➕ Add Custom Category...</span>
                              </button>

                              {selectDropdownGroups.map((groupName) => (
                                <div key={groupName} className="space-y-0.5">
                                  <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest px-2.5 pt-2.5 pb-1 block">
                                    {groupName}
                                  </div>
                                  {filteredCategoriesForSelect
                                    .filter((c) => c.group === groupName)
                                    .map((cat) => {
                                      const Icon = cat.icon;
                                      const isSelected = category === cat.value;
                                      return (
                                        <button
                                          key={cat.value}
                                          type="button"
                                          onClick={() => {
                                            setCategory(cat.value);
                                            setIsDropdownOpen(false);
                                            setCategorySearchQuery("");
                                          }}
                                          className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all hover:bg-slate-800/60 ${
                                            isSelected
                                              ? "bg-indigo-600/10 text-indigo-300 font-semibold"
                                              : "text-slate-300"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-lg ${cat.bgColor} flex items-center justify-center border border-slate-800/50`}>
                                              <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                                            </div>
                                            <span>{cat.label}</span>
                                          </div>
                                          {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-indigo-400" />
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              ))}

                              {filteredCategoriesForSelect.length === 0 && (
                                <div className="text-center text-xs text-slate-500 py-4">
                                  No categories found.
                                </div>
                              )}

                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dynamic input */}
                      {category === "CREATE_NEW_CATEGORY" && (
                        <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-indigo-500/20 space-y-1.5 animate-in slide-in-from-top-1 duration-250">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                            New Custom Category Name
                          </span>
                          <input
                            type="text"
                            placeholder="e.g. Rent, Tuition, Dog Food..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="w-full h-10 rounded-lg bg-slate-900 border border-slate-800 px-3 text-base md:text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-medium"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Amount input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                        Amount (LKR) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                        </div>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full h-12 rounded-xl bg-slate-900/90 border border-slate-800 pl-9 pr-4 text-base font-semibold text-emerald-400 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Row for Place & Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      {/* Place */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                            Place / Store
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsPlaceLocked(!isPlaceLocked)}
                            className={`text-[9px] flex items-center gap-1 px-1 rounded transition-all active:scale-95 cursor-pointer ${
                              isPlaceLocked
                                ? "text-indigo-400 bg-indigo-950/40 border border-indigo-500/30"
                                : "text-slate-600 bg-slate-950 border border-slate-900"
                            }`}
                          >
                            {isPlaceLocked ? <Pin className="w-2.5 h-2.5" /> : <PinOff className="w-2.5 h-2.5" />}
                            <span>{isPlaceLocked ? "Fixed" : "Clear"}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. Cargill's"
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            className="w-full h-11 rounded-xl bg-slate-900/90 border border-slate-800 pl-8.5 pr-3 text-base md:text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Date */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                            Date
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsDateLocked(!isDateLocked)}
                            className={`text-[9px] flex items-center gap-1 px-1 rounded transition-all active:scale-95 cursor-pointer ${
                              isDateLocked
                                ? "text-indigo-400 bg-indigo-950/40 border border-indigo-500/30"
                                : "text-slate-600 bg-slate-950 border border-slate-900"
                            }`}
                          >
                            {isDateLocked ? <Pin className="w-2.5 h-2.5" /> : <PinOff className="w-2.5 h-2.5" />}
                            <span>{isDateLocked ? "Fixed" : "Reset"}</span>
                          </button>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="date"
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                            className="w-full h-11 rounded-xl bg-slate-900/90 border border-slate-800 pl-8.5 pr-3 text-base md:text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                        Notes / Description
                      </label>
                      <div className="relative">
                        <div className="absolute top-3.5 left-3 flex items-start pointer-events-none text-slate-500">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <textarea
                          placeholder="Any extra details..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl bg-slate-900/90 border border-slate-800 pl-8.5 pr-3 py-2.5 text-base md:text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4" />
                          <span>Save Expense</span>
                        </>
                      )}
                    </button>

                  </form>
                </div>

                {/* Recent Activity List */}
                <div className="w-full bg-slate-900/20 border border-slate-800/60 rounded-3xl p-5 shadow-lg flex flex-col flex-1">
                  
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ListFilter className="w-4 h-4 text-indigo-400" />
                      <span>Recent Activity</span>
                    </h2>
                    <span className="text-xs text-slate-500 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
                      {filteredExpenses.length} items
                    </span>
                  </div>

                  {/* Filters */}
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 rounded-lg bg-slate-950/80 border border-slate-800 px-3 text-base md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <select
                      value={filterGroup}
                      onChange={(e) => setFilterGroup(e.target.value)}
                      className="h-9 rounded-lg bg-slate-950/80 border border-slate-800 px-2 text-base md:text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {groups.map((grp) => (
                        <option key={grp} value={grp} className="bg-slate-950 text-slate-300">
                          {grp === "ALL" ? "All Types" : grp}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* List */}
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent flex-1">
                    {loading ? (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                        <span className="text-xs">Loading logs...</span>
                      </div>
                    ) : filteredExpenses.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                        No recent expenses matching filters.
                      </div>
                    ) : (
                      filteredExpenses.map((exp) => {
                        const meta = getCategoryMeta(exp.category);
                        const Icon = meta.icon;
                        return (
                          <div
                            key={exp.id}
                            className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3 group transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl ${meta.bgColor} flex items-center justify-center flex-shrink-0 border border-slate-800/50`}>
                                <Icon className={`w-4 h-4 ${meta.color}`} />
                              </div>
                              
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-sm text-slate-200 truncate">
                                    {meta.label}
                                  </span>
                                  {exp.place && (
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-0.5 max-w-[80px] truncate">
                                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                      <span className="truncate">{exp.place}</span>
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {exp.expenseDate}
                                  </span>
                                  {exp.description && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                      • {exp.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <span className="font-bold text-sm text-emerald-400">
                                {exp.amount.toLocaleString("en-US")}
                              </span>
                              <button
                                onClick={() => handleDelete(exp.id)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 active:scale-90 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                                title="Delete Entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              </>
            ) : (
              /* Analytics Tab */
              <div className="w-full space-y-6 animate-in fade-in duration-200">
                
                {/* Summary Deck (Responsive Layout wrapping elements cleanly) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="bg-slate-900/40 border border-slate-850 p-2.5 sm:p-3 rounded-2xl flex flex-col justify-between col-span-1">
                    <span className="text-[10px] text-slate-400 font-medium">Month Total</span>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1">
                      <span className="text-[8px] sm:text-[9px] text-indigo-400 font-semibold uppercase leading-none">LKR</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-200 leading-none">
                        {stats.monthTotal.toLocaleString("en-US")}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-850 p-2.5 sm:p-3 rounded-2xl flex flex-col justify-between col-span-1">
                    <span className="text-[10px] text-slate-400 font-medium">Daily Avg</span>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1">
                      <span className="text-[8px] sm:text-[9px] text-emerald-400 font-semibold uppercase leading-none">LKR</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-200 leading-none">
                        {Math.round(stats.monthTotal / (dailyExpenses.length || 1)).toLocaleString("en-US")}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-850 p-2.5 sm:p-3 rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 font-medium">Total Entries</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 mt-1 truncate">
                      {expenses.length} logs
                    </span>
                  </div>
                </div>

                {/* MONTH-BY-MONTH SUMMARY */}
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-4 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span>Month-by-Month Summary</span>
                  </h3>

                  {monthlyExpenses.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-6">
                      No expense data logged yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {monthlyExpenses.map((m) => {
                        const isExpanded = expandedMonth === m.monthStr;
                        return (
                          <div
                            key={m.monthStr}
                            className="bg-slate-950/60 border border-slate-900 rounded-xl overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedMonth(isExpanded ? null : m.monthStr)}
                              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-900/40 transition-colors cursor-pointer gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-xs text-slate-200">{m.label}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-full">
                                  {m.count} {m.count === 1 ? "log" : "logs"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                                <span className="font-bold text-xs text-indigo-400">
                                  LKR {m.amount.toLocaleString("en-US")}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                              </div>
                            </button>

                            {/* Details List (Category Breakdown for this month) */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-slate-900 bg-slate-950/30 space-y-2 pt-2 animate-in slide-in-from-top-1 duration-200">
                                {Object.entries(m.categoryBreakdown)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([cat, amt]) => {
                                    const meta = getCategoryMeta(cat);
                                    const Icon = meta.icon;
                                    const pct = m.amount > 0 ? (amt / m.amount) * 100 : 0;
                                    return (
                                      <div
                                        key={cat}
                                        className="space-y-1 py-1.5 border-b border-slate-900 last:border-0"
                                      >
                                        <div className="flex items-center justify-between text-xs gap-2">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className={`w-5 h-5 rounded-md ${meta.bgColor} flex items-center justify-center border border-slate-850 shrink-0`}>
                                              <Icon className={`w-3 h-3 ${meta.color}`} />
                                            </div>
                                            <span className="font-medium text-slate-300 truncate text-[11px]">
                                              {meta.label}
                                            </span>
                                          </div>
                                          <div className="text-right flex-shrink-0 font-semibold text-slate-200 text-[10px]">
                                            LKR {amt.toLocaleString("en-US")}
                                            <span className="text-[9px] text-indigo-400 font-medium ml-1">
                                              ({pct.toFixed(0)}%)
                                            </span>
                                          </div>
                                        </div>
                                        {/* Simple Progress Bar */}
                                        <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* EXPANDABLE DAY-BY-DAY TABLE */}
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-4 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>Day-by-Day Summary</span>
                  </h3>

                  {dailyExpenses.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-6">
                      No expense data logged yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {dailyExpenses.map((day) => {
                        const isExpanded = expandedDate === day.date;
                        return (
                          <div
                            key={day.date}
                            className="bg-slate-950/60 border border-slate-900 rounded-xl overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-900/40 transition-colors cursor-pointer gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-xs text-slate-200">{day.date}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-full">
                                  {day.count} {day.count === 1 ? "log" : "logs"} • {day.items.map(item => getCategoryMeta(item.category).label).join(", ")}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                                <span className="font-bold text-xs text-emerald-400">
                                  LKR {day.amount.toLocaleString("en-US")}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                              </div>
                            </button>

                            {/* Details List */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-slate-900 bg-slate-950/30 space-y-2 pt-2 animate-in slide-in-from-top-1 duration-200">
                                {day.items.map((item) => {
                                  const meta = getCategoryMeta(item.category);
                                  const Icon = meta.icon;
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-900 last:border-0"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className={`w-6 h-6 rounded-md ${meta.bgColor} flex items-center justify-center border border-slate-850 shrink-0`}>
                                          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-slate-300 truncate">
                                            {meta.label}
                                          </p>
                                          {(item.place || item.description) && (
                                            <p className="text-[10px] text-slate-500 truncate max-w-full">
                                              {item.place && `@ ${item.place}`} {item.description && `• ${item.description}`}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="font-semibold text-slate-200 flex-shrink-0 text-right">
                                        LKR {item.amount.toLocaleString("en-US")}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CATEGORY ANALYSIS */}
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-4 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span>Category Share</span>
                  </h3>

                  {categoryBreakdown.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-6">
                      No categories logged yet.
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {categoryBreakdown.map((item) => {
                        const meta = getCategoryMeta(item.category);
                        const Icon = meta.icon;
                        const pct = stats.allTimeTotal > 0 ? (item.amount / stats.allTimeTotal) * 100 : 0;
                        return (
                          <div key={item.category} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-7 h-7 rounded-lg ${meta.bgColor} flex items-center justify-center border border-slate-800/40 shrink-0`}>
                                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                                </div>
                                <span className="font-semibold text-slate-300 truncate text-[11px] sm:text-xs">
                                  {meta.label}
                                </span>
                                <span className="text-[9px] text-slate-500 shrink-0">({item.count})</span>
                              </div>
                              <div className="text-right flex-shrink-0 font-bold text-slate-200 text-[11px] sm:text-xs">
                                LKR {item.amount.toLocaleString("en-US")}
                                <span className="text-[9px] text-indigo-400 font-medium block">
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            
                            {/* Visual Progress Bar */}
                            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-pulse"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
          
        </div>
      </main>

    </div>
  );
}
