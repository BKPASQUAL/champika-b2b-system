"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Package,
  Boxes,
  X,
  Coins,
  Palette,
  Ruler,
  ShieldCheck,
  Building2,
  Truck,
  Bookmark,
  Camera,
  Upload,
  Loader2,
  Layers,
  GitMerge,
  AlertCircle,
  Search,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Product } from "../types";

interface VariantRow {
  id: string;
  enabled: boolean;
  name: string;
  brand: string;
  subBrand?: string;
  supplier: string;
  sizeSpec: string;
  color: string;
  feature: string;
  mrp: number;
  costPrice: number;
  sellingPrice: number;
  commissionValue: number;
  retailOnly: boolean;
  retailPrice: number;
  unitOfMeasure: string;
  stock: number;
  minStock: number;
  companyCode: string;
  existingProductId?: string | null;
  existingSku?: string | null;
}

interface AttributePrice {
  mrp: string;
  cost: string;
  selling: string;
  commission: string;
}

const PRESET_LENGTHS = [
  // Switches & Sockets Gangs, Ways & Amps
  "1 Gang", "2 Gang", "3 Gang", "4 Gang", "1 Way", "2 Way", "13A", "15A", "16A", "20A", "45A",
  "13A Double", "Switched", "Unswitched", "With Neon",
  // Lighting Wattages & Sizes
  "5W", "7W", "9W", "12W", "15W", "18W", "20W", "24W", "30W", "40W", "50W", "100W",
  "2ft (9W)", "4ft (18W)", "600 x 600mm", "4 inch", "6 inch", "8 inch", "E27", "B22",
  // Cable Ties / Millimeters (mm)
  "100mm", "150mm", "200mm", "250mm", "300mm", "350mm", "400mm", "500mm",
  "2.5 x 100mm", "2.5 x 150mm", "2.5 x 200mm", "3.6 x 200mm", "3.6 x 250mm", "3.6 x 300mm",
  "4.8 x 200mm", "4.8 x 250mm", "4.8 x 300mm", "4.8 x 350mm", "4.8 x 400mm", "7.2 x 300mm",
  // Casing / Trunking / Kesin (mm & inch)
  "16 x 12.5mm", "25 x 16mm", "40 x 25mm", "50 x 25mm", "50 x 50mm", "100 x 50mm", "100 x 100mm",
  "20mm", "25mm", "32mm", "40mm", "50mm", "1/2'", "3/4'", "1'", "2'",
  // Cable Lengths & Cross-Sections
  "1m", "40m", "45m", "50m", "100m", "500m", "1.0 sqmm", "1.5 sqmm", "2.5 sqmm", "4.0 sqmm", "6.0 sqmm", "10.0 sqmm", "16.0 sqmm",
  // Breaker Current Ratings
  "6A", "10A", "16A", "20A", "25A", "32A", "40A", "63A", "100A",
  // Poles
  "1 Pole", "2 Pole", "3 Pole", "4 Pole",
  // General Sizes
  "Small", "Medium", "Large"
];
const PRESET_COLORS = [
  { name: "White", bg: "bg-slate-100", text: "text-slate-900", border: "border-slate-300" },
  { name: "Black", bg: "bg-slate-900", text: "text-white" },
  { name: "Grey", bg: "bg-slate-500", text: "text-white" },
  { name: "Gold", bg: "bg-amber-400", text: "text-amber-950" },
  { name: "Silver", bg: "bg-slate-300", text: "text-slate-900" },
  { name: "Red", bg: "bg-red-500", text: "text-white" },
  { name: "Blue", bg: "bg-blue-500", text: "text-white" },
  { name: "Yellow", bg: "bg-yellow-400", text: "text-slate-900" },
  { name: "Green", bg: "bg-emerald-600", text: "text-white" },
  { name: "Brown", bg: "bg-amber-800", text: "text-white" },
];
const PRESET_FEATURES = [
  // Switches & Protection
  "(Breaker)", "Switched", "Unswitched", "With Neon", "30mA", "100mA", "300mA", "6kA", "10kA", "Type C",
  // Lighting Features & Color Temp
  "Daylight (6500K)", "Warm White (3000K)", "Cool White (4000K)", "Dimmable", "IP65 Waterproof", "Surface Mounted", "Recessed",
  // Wire / Hardware grades
  "Fire Guard", "Fire Seal", "Standard", "Eco", "Heavy Duty", "(No Warranty)"
];
const PRESET_PACK_SIZES = [
  "Pcs (1 pc)", "Pkt (100 Pcs)", "Pkt (50 Pcs)", "Pkt (25 Pcs)", "Box (10 Pcs)", "Box (20 Pcs)", "Box (50 Pcs)", "Box (100 Pcs)", "Box (1000 Pcs)", "Coil (100m)", "Coil (50m)", "Roll", "Bundle", "Carton", "Bag", "Set", "Dozen (12 Pcs)", "Meters"
];
const PRESET_SUB_BRANDS = [
  "Sigma", "Alpha", "Aljal", "Alka", "Elegance", "Orina", "Concept", "Spark", "Vivo", "Matrix", "Commander", "Classic", "Curv", "Sense", "FireGuard"
];
const PRESET_BASE_ITEMS = [
  // Switches & Sockets
  "1 Gang 1 Way Switch", "1 Gang 2 Way Switch", "2 Gang 1 Way Switch", "3 Gang 1 Way Switch", "4 Gang 1 Way Switch",
  "13A Socket", "15A Socket", "13A Double Socket", "Fan Regulator", "Dimmer Switch", "Bell Press",
  "Cooker Control Unit", "Shaver Socket", "Data Socket RJ45", "Telephone Socket RJ11", "TV Socket",
  // Bulbs & Lighting
  "LED Bulb", "LED T8 Tube Light", "LED Panel Light", "LED Downlight", "LED Flood Light",
  "Batten Holder", "Pendant Holder", "Angle Holder", "Ceiling Rose",
  // Breakers & Protection
  "MCB 1 Pole", "MCB 2 Pole", "MCB 3 Pole", "MCB 4 Pole",
  "RCD 2 Pole", "RCD 4 Pole", "RCCB 2 Pole", "RCCB 4 Pole",
  "Isolator 2 Pole", "Isolator 4 Pole", "Main Switch 63A", "Surge Protection Device (SPD)", "Changeover Switch",
  // Wires & Accessories
  "1/1.13 Wire", "7/0.67 Wire", "7/1.04 Wire", "Flexible Cable", "Twin Flat Wire", "Cable Tie", "Casing (Kesin)"
];

const STEPS = [
  { id: 1, name: "Base Details", desc: "Core name & category" },
  { id: 2, name: "Attributes & Images", desc: "Brands, sizes & colors" },
  { id: 3, name: "Pricing & Stock", desc: "Per-variant prices" },
  { id: 4, name: "Review & Merge", desc: "Matrix & existing products" },
];

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
  allowCustom?: boolean;
  onAddCustom?: (val: string) => void;
  quickOptions?: string[];
  icon?: React.ReactNode;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
  onAddCustom,
  quickOptions = [],
  icon,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const handleOpen = () => {
    setIsOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const handleCreateCustom = () => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    if (onAddCustom) onAddCustom(trimmed);
    onChange(trimmed);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full space-y-1.5" ref={dropdownRef}>
      {/* Trigger Box */}
      <div
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg border bg-slate-50/50 flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? "border-blue-500 bg-white ring-2 ring-blue-100" : "border-slate-200 hover:bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {value ? (
            <span className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" /> {value}
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Popover Dropdown with Search */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Box inside Popup */}
          <div className="p-2 border-b bg-slate-50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length > 0) {
                    handleSelect(filtered[0]);
                  } else if (allowCustom && query.trim()) {
                    handleCreateCustom();
                  }
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                }
              }}
              placeholder="Type to search..."
              className="w-full text-xs bg-transparent outline-none placeholder:text-slate-400 font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List of Options */}
          <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
            {filtered.map((opt) => {
              const isSelected = value === opt;
              return (
                <div
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-900 font-bold"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-3 text-center">
                <p className="text-xs text-slate-400">No matching items found</p>
                {allowCustom && query.trim() && (
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    className="mt-2 w-full px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add &ldquo;{query.trim()}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Shortcuts */}
      {quickOptions.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap pt-0.5">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Quick:</span>
          {quickOptions.map((qOpt) => {
            const isSel = value === qOpt;
            return (
              <button
                key={qOpt}
                type="button"
                onClick={() => onChange(isSel ? "" : qOpt)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                  isSel
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {qOpt.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProductMatrixGeneratorPage() {
  const router = useRouter();

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<number>(1);

  // API Data
  const { data: existingProducts = [] } = useCachedFetch<Product[]>("/api/products", []);
  const { data: rawSuppliers = [] } = useCachedFetch<any[]>("/api/suppliers", []);
  const { data: settingSuppliers = [] } = useCachedFetch<any[]>(
    "/api/settings/categories?type=supplier",
    []
  );
  const { data: categories = [] } = useCachedFetch<{ id: string; name: string; parent_id?: string }[]>(
    "/api/settings/categories?type=category",
    []
  );
  const { data: brandsList = [] } = useCachedFetch<{ id: string; name: string }[]>(
    "/api/settings/categories?type=brand",
    []
  );
  const { data: packSizes = [] } = useCachedFetch<{ id: string; name: string; description?: string }[]>(
    "/api/settings/categories?type=pack_size",
    []
  );

  const FIXED_SUPPLIERS = ["Orange (Orel Corporation)"];

  // Deduplicated Suppliers list
  const allSuppliers = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    FIXED_SUPPLIERS.forEach((name) => uniqueMap.set(name.toLowerCase().trim(), name.trim()));

    [...rawSuppliers, ...settingSuppliers].forEach((s) => {
      const name = (s.name || s.supplier_name || "").trim();
      if (name && !uniqueMap.has(name.toLowerCase())) {
        uniqueMap.set(name.toLowerCase(), name);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
  }, [rawSuppliers, settingSuppliers]);

  // Deduplicated Brands list
  const allBrands = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    ["Orange", "Sierra", "ACL", "Ruhunu", "Kelani"].forEach((name) =>
      uniqueMap.set(name.toLowerCase().trim(), name.trim())
    );

    brandsList.forEach((b) => {
      const name = (b.name || "").trim();
      if (name && !uniqueMap.has(name.toLowerCase())) {
        uniqueMap.set(name.toLowerCase(), name);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
  }, [brandsList]);

  // Deduplicated Sub-Brands / Series list
  const allSubBrands = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    PRESET_SUB_BRANDS.forEach((name) =>
      uniqueMap.set(name.toLowerCase().trim(), name.trim())
    );

    existingProducts.forEach((p) => {
      const name = (p.subBrand || (p as any).sub_brand || "").trim();
      if (name && !uniqueMap.has(name.toLowerCase())) {
        uniqueMap.set(name.toLowerCase(), name);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
  }, [existingProducts]);

  // Deduplicated Lengths / Sizes / Specs list (Presets + Database extracted)
  const allSizes = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    PRESET_LENGTHS.forEach((sz) =>
      uniqueMap.set(sz.toLowerCase().trim(), sz.trim())
    );

    existingProducts.forEach((p) => {
      const sz = (p.sizeSpec || (p as any).size_spec || "").trim();
      if (sz && !uniqueMap.has(sz.toLowerCase())) {
        uniqueMap.set(sz.toLowerCase(), sz);
      }
    });

    return Array.from(uniqueMap.values());
  }, [existingProducts]);

  // Deduplicated Pack Sizes / Units list (Presets + API + Database extracted)
  const allPackSizes = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    PRESET_PACK_SIZES.forEach((p) => uniqueMap.set(p.toLowerCase().trim(), p.trim()));

    packSizes.forEach((p) => {
      let label = (p.name || "").trim();
      const desc = (p.description || "").trim();
      if (desc && !label.toLowerCase().includes(desc.toLowerCase()) && !desc.toLowerCase().includes(label.toLowerCase())) {
        label = `${label} (${desc})`;
      }
      if (label && !uniqueMap.has(label.toLowerCase())) {
        uniqueMap.set(label.toLowerCase(), label);
      }
    });

    existingProducts.forEach((p) => {
      const uom = (p.unitOfMeasure || (p as any).unit_of_measure || "").trim();
      if (uom && !uniqueMap.has(uom.toLowerCase())) {
        uniqueMap.set(uom.toLowerCase(), uom);
      }
    });

    return Array.from(uniqueMap.values());
  }, [packSizes, existingProducts]);

  // Main Categories & Subcategories
  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  // Step 1: Base Product Details
  const [baseName, setBaseName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [defaultUnitOfMeasure, setDefaultUnitOfMeasure] = useState("Pcs");

  // Step 2: Attributes & Images (Single-select for Supplier & Brand, Multi-select for SubBrands & Specs)
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [customSupplierInput, setCustomSupplierInput] = useState("");

  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [customBrandInput, setCustomBrandInput] = useState("");

  const [selectedSubBrands, setSelectedSubBrands] = useState<string[]>([]);
  const [customSubBrandInput, setCustomSubBrandInput] = useState("");
  const [subBrandFilterQuery, setSubBrandFilterQuery] = useState("");

  const filteredSubBrandsList = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    allSubBrands.forEach((sb) => uniqueMap.set(sb.toLowerCase().trim(), sb.trim()));
    selectedSubBrands.forEach((sb) => {
      if (sb && !uniqueMap.has(sb.toLowerCase().trim())) {
        uniqueMap.set(sb.toLowerCase().trim(), sb.trim());
      }
    });
    const combined = Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
    if (!subBrandFilterQuery.trim()) return combined;
    const q = subBrandFilterQuery.toLowerCase().trim();
    return combined.filter((sb) => sb.toLowerCase().includes(q));
  }, [allSubBrands, selectedSubBrands, subBrandFilterQuery]);

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [sizeFilterQuery, setSizeFilterQuery] = useState("");
  const [sizeFilterCategory, setSizeFilterCategory] = useState<"all" | "switches" | "lighting" | "breakers" | "cables" | "ties">("all");

  const filteredSizesList = useMemo(() => {
    let list = allSizes;
    if (sizeFilterCategory === "switches") {
      list = list.filter((s) => s.includes("Gang") || s.includes("Way") || s.includes("13A") || s.includes("15A") || s.includes("16A") || s.includes("20A") || s.includes("45A") || s.includes("Switched") || s.includes("Neon") || s.includes("Double"));
    } else if (sizeFilterCategory === "lighting") {
      list = list.filter((s) => s.endsWith("W") || s.includes("ft") || s.includes("E27") || s.includes("B22") || s.includes("inch") || s.includes("600"));
    } else if (sizeFilterCategory === "breakers") {
      list = list.filter((s) => (s.endsWith("A") && !s.includes("13A") && !s.includes("15A") && !s.includes("16A") && !s.includes("20A") && !s.includes("45A")) || s.includes("Pole") || s.includes("1P") || s.includes("2P"));
    } else if (sizeFilterCategory === "cables") {
      list = list.filter((s) => (s.endsWith("m") && !s.endsWith("mm")) || s.includes("sqmm") || s.includes("Coil") || s.includes("Meters"));
    } else if (sizeFilterCategory === "ties") {
      list = list.filter((s) => s.includes("mm") || s.includes("x") || s.includes("*") || s.includes("'") || s.includes('"'));
    }

    if (!sizeFilterQuery.trim()) return list;
    const q = sizeFilterQuery.toLowerCase().trim();
    return list.filter((s) => s.toLowerCase().includes(q));
  }, [allSizes, sizeFilterCategory, sizeFilterQuery]);

  // Step 2: Pack Sizes / Units State
  const [selectedPackSizes, setSelectedPackSizes] = useState<string[]>([]);
  const [customPackSizeInput, setCustomPackSizeInput] = useState("");
  const [packSizeFilterQuery, setPackSizeFilterQuery] = useState("");
  const [includePackInName, setIncludePackInName] = useState<boolean>(false);

  const filteredPackSizesList = useMemo(() => {
    if (!packSizeFilterQuery.trim()) return allPackSizes;
    const q = packSizeFilterQuery.toLowerCase().trim();
    return allPackSizes.filter((p) => p.toLowerCase().includes(q));
  }, [allPackSizes, packSizeFilterQuery]);

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customColorInput, setCustomColorInput] = useState("");

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [customFeatureInput, setCustomFeatureInput] = useState("");

  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Pricing & Stock Rules
  const [baseRetailOnly, setBaseRetailOnly] = useState<boolean>(false);
  const [baseInitialStock, setBaseInitialStock] = useState<string>("0");
  const [baseMinStock, setBaseMinStock] = useState<string>("5");
  const [sizePrices, setSizePrices] = useState<Record<string, AttributePrice>>({});

  // Step 4: Matrix Rows State
  const [matrixRows, setMatrixRows] = useState<VariantRow[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Quick Update in Matrix Bar
  const [bulkMrp, setBulkMrp] = useState<string>("");
  const [bulkCost, setBulkCost] = useState<string>("");
  const [bulkSelling, setBulkSelling] = useState<string>("");
  const [bulkRetailPrice, setBulkRetailPrice] = useState<string>("");
  const [bulkCommission, setBulkCommission] = useState<string>("");
  const [bulkMarginPct, setBulkMarginPct] = useState<string>("");

  const subCategories = useMemo(() => {
    const selectedCatObj = mainCategories.find((c) => c.name === category);
    if (!selectedCatObj) return [];
    return categories.filter((c) => c.parent_id === selectedCatObj.id);
  }, [category, mainCategories, categories]);

  // Image Upload Logic
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (images.length + files.length > 6) {
      toast.error("Maximum 6 images allowed");
      return;
    }
    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploadedUrls.push(data.url);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
      toast.success("Images uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const maxImages = 6;
  const showUploadSlot = images.length < maxImages;
  const emptySlotsCount = maxImages - images.length - (showUploadSlot ? 1 : 0);
  const emptySlots = Array.from({ length: Math.max(0, emptySlotsCount) });

  // Toggle helper for arrays
  const toggleArrayItem = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  // Format:
  // - Breakers: [Brand] [Sub-Brand] [Base Model/Pole] [Rating/Size] [Sensitivity/Suffix] (e.g. Orange Sigma MCB 1 Pole 10A (Breaker) or Orange Sigma RCD 2 Pole 40A 30mA)
  // - Cables: [Brand] [Feature] [Base Name] [Length] [Color] (e.g. ACL Fire Guard 1/1.13 100m Red)
  const buildProductName = (
    brand: string,
    subBrand: string,
    feat: string,
    base: string,
    size: string,
    color: string,
    packSize?: string
  ) => {
    const isSuffixFeature =
      feat &&
      (feat.startsWith("(") ||
        feat.endsWith("mA") ||
        feat.endsWith("kA") ||
        feat.toLowerCase().includes("breaker") ||
        feat.toLowerCase().includes("warranty"));

    const displayBrand =
      brand.toLowerCase() === "common" || brand.toLowerCase() === "general" || brand.toLowerCase() === "retail"
        ? ""
        : brand;
    const displaySubBrand =
      subBrand?.toLowerCase() === "common" || subBrand?.toLowerCase() === "general" ? "" : subBrand;

    const parts = isSuffixFeature
      ? [displayBrand, displaySubBrand, base, size, color, feat]
      : [displayBrand, displaySubBrand, feat, base, size, color];

    if (includePackInName && packSize && packSize.trim()) {
      parts.push(packSize.trim());
    }

    return parts.filter((p) => p && p.trim() !== "").join(" ");
  };

  // Helper to update specific size price override and sync matrix rows
  const handleSetSizePrice = (size: string, field: keyof AttributePrice, val: string) => {
    setSizePrices((prev) => {
      const updatedObj = {
        mrp: prev[size]?.mrp || "",
        cost: prev[size]?.cost || "",
        selling: prev[size]?.selling || "",
        commission: prev[size]?.commission || "",
        [field]: val,
      };

      setMatrixRows((rows) =>
        rows.map((r) => {
          const rowSize = r.sizeSpec || "Standard";
          if (rowSize === size || (size === "Standard" && !r.sizeSpec)) {
            const numMrp = updatedObj.mrp !== "" ? Number(updatedObj.mrp) : r.mrp;
            const numCost = updatedObj.cost !== "" ? Number(updatedObj.cost) : r.costPrice;
            const numSell = updatedObj.selling !== "" ? Number(updatedObj.selling) : r.sellingPrice;
            const numComm = updatedObj.commission !== "" ? Number(updatedObj.commission) : r.commissionValue;
            return {
              ...r,
              mrp: numMrp,
              costPrice: numCost,
              sellingPrice: numSell,
              commissionValue: numComm,
              retailPrice: r.retailOnly ? numSell : r.retailPrice,
            };
          }
          return r;
        })
      );

      return {
        ...prev,
        [size]: updatedObj,
      };
    });
  };

  const handleUpdateBaseInitialStock = (val: string) => {
    setBaseInitialStock(val);
    const num = Number(val) || 0;
    setMatrixRows((rows) =>
      rows.map((r) => (!r.existingProductId ? { ...r, stock: num } : r))
    );
  };

  const handleUpdateBaseMinStock = (val: string) => {
    setBaseMinStock(val);
    const num = Number(val) || 0;
    setMatrixRows((rows) => rows.map((r) => ({ ...r, minStock: num })));
  };

  const handleUpdateBaseRetailOnly = (val: boolean) => {
    setBaseRetailOnly(val);
    setMatrixRows((rows) =>
      rows.map((r) => ({
        ...r,
        retailOnly: val,
        retailPrice: val ? r.sellingPrice : 0,
      }))
    );
  };

  // Live combinations for Current Chip Selection (1 Supplier x 1 Brand x SubBrands x Pack Sizes x Sizes x Colors x Features)
  const livePreviewCombos = useMemo(() => {
    // Only generate preview if the user has actively selected at least one dimension/attribute
    const hasAnySelection =
      !!selectedBrand ||
      !!selectedSupplier ||
      selectedSubBrands.length > 0 ||
      selectedSizes.length > 0 ||
      selectedColors.length > 0 ||
      selectedFeatures.length > 0 ||
      selectedPackSizes.length > 0;

    if (!hasAnySelection) {
      return [];
    }

    const effectiveBrand = selectedBrand || selectedSupplier || "Common";
    const effectiveSupplier = selectedSupplier || selectedBrand || "Common";
    const subBrandsToUse = selectedSubBrands.length > 0 ? selectedSubBrands : [""];
    const sizesToUse = selectedSizes.length > 0 ? selectedSizes : [""];
    const packSizesToUse = selectedPackSizes.length > 0 ? selectedPackSizes : [defaultUnitOfMeasure || "Pcs"];
    const colorsToUse = selectedColors.length > 0 ? selectedColors : [""];
    const featuresToUse = selectedFeatures.length > 0 ? selectedFeatures : [""];

    const list: {
      name: string;
      brand: string;
      subBrand?: string;
      supplier: string;
      size: string;
      color: string;
      feature: string;
      packSize: string;
    }[] = [];

    for (const sb of subBrandsToUse) {
      for (const ps of packSizesToUse) {
        for (const sz of sizesToUse) {
          for (const col of colorsToUse) {
            for (const ft of featuresToUse) {
              const name = buildProductName(
                selectedBrand,
                sb,
                ft,
                baseName.trim() || "Item",
                sz,
                col,
                ps
              );
              list.push({
                name,
                brand: effectiveBrand,
                subBrand: sb || undefined,
                supplier: effectiveSupplier,
                size: sz,
                color: col,
                feature: ft,
                packSize: ps,
              });
            }
          }
        }
      }
    }
    return list;
  }, [
    selectedBrand,
    selectedSupplier,
    selectedSubBrands,
    selectedSizes,
    selectedPackSizes,
    defaultUnitOfMeasure,
    includePackInName,
    selectedColors,
    selectedFeatures,
    baseName,
  ]);

  // Add currently selected chips to the Staged Products Matrix Table
  const addSelectionToTable = () => {
    const defaultInitStock = Number(baseInitialStock) || 0;
    const defaultMinStock = Number(baseMinStock) || 5;

    const newlyAdded: VariantRow[] = [];
    let count = matrixRows.length;

    for (const item of livePreviewCombos) {
      const alreadyInTable = matrixRows.some(
        (r) =>
          r.name.toLowerCase().trim() === item.name.toLowerCase().trim() &&
          r.unitOfMeasure.toLowerCase().trim() === (item.packSize || defaultUnitOfMeasure).toLowerCase().trim()
      );
      if (alreadyInTable) continue;

      count++;
      const id = `var-${item.brand}-${item.subBrand || "none"}-${item.supplier}-${item.size}-${item.color}-${item.feature}-${item.packSize || "uom"}-${count}`
        .replace(/\s+/g, "-")
        .toLowerCase();

      const sizePriceObj = (item.size ? sizePrices[item.size] : null) || sizePrices["Standard"] || sizePrices[""];
      const costVal = sizePriceObj && sizePriceObj.cost !== "" ? Number(sizePriceObj.cost) : 0;
      const mrpVal = sizePriceObj && sizePriceObj.mrp !== "" ? Number(sizePriceObj.mrp) : 0;
      const sellingVal =
        sizePriceObj && sizePriceObj.selling !== ""
          ? Number(sizePriceObj.selling)
          : (costVal > 0 ? Math.round(costVal * 1.15 * 100) / 100 : 0);
      const commVal = sizePriceObj && sizePriceObj.commission !== "" ? Number(sizePriceObj.commission) : 0;

      newlyAdded.push({
        id,
        enabled: true,
        name: item.name,
        brand: item.brand,
        subBrand: item.subBrand,
        supplier: item.supplier,
        sizeSpec: item.size,
        color: item.color,
        feature: item.feature,
        mrp: mrpVal,
        costPrice: costVal,
        sellingPrice: sellingVal,
        commissionValue: commVal,
        retailOnly: baseRetailOnly,
        retailPrice: baseRetailOnly ? sellingVal : 0,
        unitOfMeasure: item.packSize || defaultUnitOfMeasure || "Pcs",
        stock: defaultInitStock,
        minStock: defaultMinStock,
        companyCode: "",
        existingProductId: null,
        existingSku: null,
      });
    }

    if (newlyAdded.length === 0) {
      toast.info("Selected items are already in the table.");
      return;
    }

    setMatrixRows((prev) => [...prev, ...newlyAdded]);
    toast.success(`Added ${newlyAdded.length} product(s) to table! Total: ${matrixRows.length + newlyAdded.length}`);

    // Clear chips for the next product selection
    setSelectedSupplier("");
    setSelectedBrand("");
    setSelectedSubBrands([]);
    setSelectedSizes([]);
    setSelectedPackSizes([]);
    setSelectedColors([]);
    setSelectedFeatures([]);
  };

  // Clear current chip selections
  const clearCurrentSelections = () => {
    setSelectedSupplier("");
    setSelectedBrand("");
    setSelectedSubBrands([]);
    setSelectedSizes([]);
    setSelectedPackSizes([]);
    setSelectedColors([]);
    setSelectedFeatures([]);
    toast.info("Attribute selections cleared.");
  };

  // Update specific field for an individual matrix row
  const updateMatrixRowField = (id: string, field: keyof VariantRow, value: any) => {
    setMatrixRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "sellingPrice") {
          if (updated.retailOnly && (!updated.retailPrice || updated.retailPrice === r.sellingPrice)) {
            updated.retailPrice = value;
          }
        }
        if (field === "retailOnly") {
          if (value && (!updated.retailPrice || updated.retailPrice === 0)) {
            updated.retailPrice = updated.sellingPrice || 0;
          }
        }
        return updated;
      })
    );
  };

  // Remove single row from staged table
  const removeMatrixRow = (id: string) => {
    setMatrixRows((prev) => prev.filter((r) => r.id !== id));
    toast.info("Product removed from table.");
  };

  // Clear all staged rows
  const clearAllMatrixRows = () => {
    setMatrixRows([]);
    toast.info("All products removed from table.");
  };

  // Unique sizes across all staged matrix rows
  const stagedSizes = useMemo(() => {
    const set = new Set<string>();
    matrixRows.forEach((r) => {
      set.add(r.sizeSpec || "Standard");
    });
    return set.size > 0 ? Array.from(set) : (selectedSizes.length > 0 ? selectedSizes : ["Standard"]);
  }, [matrixRows, selectedSizes]);

  // Step Validation & Navigation
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!baseName.trim()) {
        toast.error("Please enter a Base Product Name.");
        return;
      }
      if (!category) {
        toast.error("Please select a Category.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (matrixRows.length === 0) {
        addSelectionToTable();
        setCurrentStep(3);
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      // Only upon entering Step 4, detect matches with existing products
      setMatrixRows((prev) =>
        prev.map((r) => {
          const match = existingProducts.find(
            (p) =>
              p.name.toLowerCase().trim() === r.name.toLowerCase().trim() ||
              (p.brand?.toLowerCase() === r.brand.toLowerCase() &&
                p.supplier?.toLowerCase() === r.supplier.toLowerCase() &&
                p.sizeSpec?.toLowerCase() === r.sizeSpec.toLowerCase() &&
                p.name.toLowerCase().includes(baseName.toLowerCase().trim()))
          );
          return {
            ...r,
            existingProductId: match?.id || null,
            existingSku: match?.sku || null,
          };
        })
      );
      setCurrentStep(4);
    }
  };

  // Bulk Apply updates to matrix
  const applyBulkPricing = () => {
    if (matrixRows.length === 0) return;

    setMatrixRows((prev) =>
      prev.map((row) => {
        if (!row.enabled) return row;
        if (activeGroupFilter !== "all" && row.sizeSpec !== activeGroupFilter && row.brand !== activeGroupFilter) {
          return row;
        }

        const updated = { ...row };
        if (bulkMrp !== "") updated.mrp = Number(bulkMrp) || 0;
        if (bulkCost !== "") updated.costPrice = Number(bulkCost) || 0;
        if (bulkSelling !== "") {
          updated.sellingPrice = Number(bulkSelling) || 0;
          if (updated.retailOnly && (!updated.retailPrice || updated.retailPrice === 0)) {
            updated.retailPrice = updated.sellingPrice;
          }
        } else if (bulkMarginPct !== "" && updated.costPrice > 0) {
          const margin = Number(bulkMarginPct) || 0;
          updated.sellingPrice = Math.round(updated.costPrice * (1 + margin / 100) * 100) / 100;
          if (updated.retailOnly && (!updated.retailPrice || updated.retailPrice === 0)) {
            updated.retailPrice = updated.sellingPrice;
          }
        }
        if (bulkRetailPrice !== "") updated.retailPrice = Number(bulkRetailPrice) || 0;
        if (bulkCommission !== "") updated.commissionValue = Number(bulkCommission) || 0;
        return updated;
      })
    );
    toast.success(
      activeGroupFilter === "all"
        ? "Bulk pricing applied to all rows!"
        : `Bulk pricing applied to [${activeGroupFilter}] rows!`
    );
  };

  // Save all enabled matrix rows into database
  const handleSaveToCatalog = async () => {
    const activeRows = matrixRows.filter((r) => r.enabled);
    if (activeRows.length === 0) {
      toast.error("No active variants selected to save.");
      return;
    }

    setIsSaving(true);
    try {
      const payloadProducts = activeRows.map((r) => ({
        name: r.name,
        companyCode: r.companyCode,
        category,
        subCategory: subCategory || null,
        brand: r.brand,
        subBrand: r.subBrand || null,
        supplier: r.supplier,
        sizeSpec: r.sizeSpec || null,
        modelType: r.feature || null,
        subModel: r.color || null,
        stock: r.stock,
        minStock: r.minStock,
        mrp: r.mrp,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        commissionValue: r.commissionValue,
        retailOnly: r.retailOnly,
        retailPrice: r.retailPrice,
        unitOfMeasure: r.unitOfMeasure,
        images: images,
        existingProductId: r.existingProductId || null,
        isActive: true,
      }));

      const res = await fetch("/api/products/batch-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: payloadProducts }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process products");
      }

      toast.success(`Successfully saved/merged ${data.createdCount} products!`);
      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} items had warnings.`);
      }

      router.push("/dashboard/office/distribution/products");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save products.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered rows for spreadsheet search and active group tab
  const filteredRows = useMemo(() => {
    let rows = matrixRows;
    if (activeGroupFilter !== "all") {
      rows = rows.filter((r) => r.sizeSpec === activeGroupFilter || r.brand === activeGroupFilter);
    }
    if (!searchFilter.trim()) return rows;
    const q = searchFilter.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        r.sizeSpec.toLowerCase().includes(q) ||
        r.color.toLowerCase().includes(q) ||
        r.feature.toLowerCase().includes(q) ||
        (r.existingSku && r.existingSku.toLowerCase().includes(q))
    );
  }, [matrixRows, searchFilter, activeGroupFilter]);

  const enabledCount = matrixRows.filter((r) => r.enabled).length;
  const mergedCount = matrixRows.filter((r) => r.enabled && r.existingProductId).length;
  const newCount = enabledCount - mergedCount;

  const totalPossibleCombos = livePreviewCombos.length;

  const matrixSizes = useMemo(() => {
    return [...new Set(matrixRows.map((r) => r.sizeSpec).filter(Boolean))];
  }, [matrixRows]);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/office/distribution/products"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Products Catalog
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-slate-900">
            <Boxes className="w-8 h-8 text-blue-600" />
            Product Matrix & Multi-Variant Builder
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Step-by-step wizard to define base items, combine dimensions, set prices, and connect/merge with existing products.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/office/distribution/products")}
          >
            Cancel
          </Button>
          {currentStep === 4 && matrixRows.length > 0 && (
            <Button
              onClick={handleSaveToCatalog}
              disabled={isSaving || enabledCount === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save & Merge {enabledCount} Products
            </Button>
          )}
        </div>
      </div>

      {/* STEPPER PROGRESS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border shadow-xs">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                isActive
                  ? "bg-blue-50 border-2 border-blue-500 text-blue-900 shadow-sm"
                  : isCompleted
                  ? "bg-emerald-50/70 border border-emerald-300/80 text-emerald-900 hover:bg-emerald-100/60"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isCompleted
                    ? "bg-emerald-600 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {isCompleted ? "✓" : step.id}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold leading-none">{step.name}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-1">{step.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* STEP 1: BASE PRODUCT DETAILS                              */}
      {/* ========================================================= */}
      {currentStep === 1 && (
        <Card className="border-slate-200 shadow-sm w-full">
          <CardHeader className="pb-4 border-b bg-slate-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Step 1: Base Product Details
              </CardTitle>
              <Badge variant="outline" className="bg-white text-slate-700 font-mono text-xs">
                Base Specification
              </Badge>
            </div>
            <CardDescription>
              Define the common base item name (e.g. 1/113 Wire, Batten Holder) and standard category.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            {/* Base Product Name */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">
                Base Product Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={baseName}
                onChange={(e) => setBaseName(e.target.value)}
                placeholder="e.g. 1/113 or 3/029 Wire or Angle Batten Holder"
                className="font-medium h-11 border-slate-300 focus-visible:ring-blue-500 text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Common core item name that will be shared across all sizes, brands, and suppliers.
              </p>

              {/* Quick Suggestions for Base Name */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Popular Base Item Templates:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_BASE_ITEMS.slice(0, 16).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setBaseName(item);
                        // Auto-suggest category if matching
                        if (item.includes("Switch") || item.includes("Socket") || item.includes("Regulator") || item.includes("Press")) {
                          const matchCat = categories.find((c) => c.name.toLowerCase().includes("switch") || c.name.toLowerCase().includes("wiring"));
                          if (matchCat) setCategory(matchCat.name);
                        } else if (item.includes("LED") || item.includes("Bulb") || item.includes("Holder") || item.includes("Light")) {
                          const matchCat = categories.find((c) => c.name.toLowerCase().includes("light") || c.name.toLowerCase().includes("bulb") || c.name.toLowerCase().includes("wiring"));
                          if (matchCat) setCategory(matchCat.name);
                        } else if (item.includes("MCB") || item.includes("RCD") || item.includes("RCCB") || item.includes("Isolator")) {
                          const matchCat = categories.find((c) => c.name.toLowerCase().includes("breaker") || c.name.toLowerCase().includes("distribution"));
                          if (matchCat) setCategory(matchCat.name);
                        } else if (item.includes("Wire") || item.includes("Cable")) {
                          const matchCat = categories.find((c) => c.name.toLowerCase().includes("cable") || c.name.toLowerCase().includes("wire"));
                          if (matchCat) setCategory(matchCat.name);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                        baseName === item
                          ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category & Sub-Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(val) => {
                    setCategory(val);
                    setSubCategory("");
                  }}
                >
                  <SelectTrigger className="w-full h-11 text-sm">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Sub-Category</Label>
                <Select
                  value={subCategory}
                  onValueChange={setSubCategory}
                  disabled={!category || subCategories.length === 0}
                >
                  <SelectTrigger className="w-full h-11 text-sm">
                    <SelectValue placeholder={subCategories.length > 0 ? "Select Sub-Category" : "None"} />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((sc) => (
                      <SelectItem key={sc.id} value={sc.name}>
                        {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Unit of Measure / Pack Size */}
            <div className="space-y-2 pt-1">
              <Label className="text-sm font-semibold text-slate-800">Default Pack Size / Unit</Label>
              <Select value={defaultUnitOfMeasure} onValueChange={setDefaultUnitOfMeasure}>
                <SelectTrigger className="w-full h-11 text-sm">
                  <SelectValue placeholder="Select Unit" />
                </SelectTrigger>
                <SelectContent>
                  {!packSizes.some((p) => p.name.toLowerCase() === "pcs") && (
                    <SelectItem value="Pcs">Pcs (1 pc)</SelectItem>
                  )}
                  {packSizes.map((pack) => (
                    <SelectItem key={pack.id} value={pack.name}>
                      {pack.name} {pack.description && `(${pack.description})`}
                    </SelectItem>
                  ))}
                  <SelectItem value="Coil">Coil (100m)</SelectItem>
                  <SelectItem value="Meters">Meters</SelectItem>
                  <SelectItem value="Box">Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t bg-slate-50/50 p-4">
            <span className="text-xs text-muted-foreground">Step 1 of 4</span>
            <Button onClick={handleNextStep} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Next: Select Attributes <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ========================================================= */}
      {/* STEP 2: ATTRIBUTES & IMAGE UPLOADS                        */}
      {/* ========================================================= */}
      {currentStep === 2 && (
        <Card className="border-slate-200 shadow-sm w-full">
          <CardHeader className="pb-3 border-b bg-slate-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Step 2: Variant Dimensions, Attributes & Images
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-semibold text-blue-700 bg-blue-50 border-blue-200">
                {totalPossibleCombos} Combinations
              </Badge>
            </div>
            <CardDescription>
              Select separate Suppliers, Brands, Lengths, Colors, Features, and upload Product Images.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN: Suppliers, Brands, Sizes */}
              <div className="space-y-6">
                {/* Attribute 1: Supplier (Searchable Combobox) */}
                <div className="space-y-2 p-4 rounded-xl border bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" /> 1. Supplier (Select One)
                    </Label>
                    {selectedSupplier ? (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold flex items-center gap-1">
                        ✓ {selectedSupplier}
                        <button
                          type="button"
                          onClick={() => setSelectedSupplier("")}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None selected</span>
                    )}
                  </div>

                  <SearchableSelect
                    value={selectedSupplier}
                    onChange={setSelectedSupplier}
                    options={allSuppliers}
                    placeholder="🔍 Click & type to search supplier (or leave Common)..."
                    quickOptions={["Common", "Orange (Orel Corporation)", "ACL Cables", "Kelani", "Wireman (Orel Corporation)", "China"]}
                    allowCustom={true}
                    onAddCustom={(newSup) => {
                      setSelectedSupplier(newSup);
                      toast.success(`Selected custom supplier: ${newSup}`);
                    }}
                  />
                </div>

                {/* Attribute 2: Brand (Searchable Combobox) */}
                <div className="space-y-2 p-4 rounded-xl border bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-600" /> 2. Brand (Select One)
                    </Label>
                    {selectedBrand ? (
                      <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold flex items-center gap-1">
                        ✓ {selectedBrand}
                        <button
                          type="button"
                          onClick={() => setSelectedBrand("")}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None (Common)</span>
                    )}
                  </div>

                  <SearchableSelect
                    value={selectedBrand}
                    onChange={setSelectedBrand}
                    options={allBrands}
                    placeholder="🔍 Click & type to search brand (or leave Common)..."
                    quickOptions={["Common", "Orange", "ACL", "Kelani", "Sierra", "China", "Wireman"]}
                    allowCustom={true}
                    onAddCustom={(newBrand) => {
                      setSelectedBrand(newBrand);
                      toast.success(`Selected custom brand: ${newBrand}`);
                    }}
                  />
                </div>

                {/* Attribute 3: Sub-Brand / Series (Multi-Select Chips + Search + Custom Add) */}
                <div className="space-y-3 p-4 rounded-xl border bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-violet-600" /> 3. Sub-Brand / Series (Multi-Select)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-violet-50 text-violet-800 border-violet-200 text-xs font-bold">
                        {selectedSubBrands.length > 0
                          ? `${selectedSubBrands.length} Selected`
                          : "None (Standard)"}
                      </Badge>
                      {selectedSubBrands.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSubBrands([])}
                          className="text-[11px] text-red-600 hover:underline font-medium"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Filter for Sub-Brands */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Type to search sub-brands / series (e.g. Sigma, Alpha, Elegance)..."
                      value={subBrandFilterQuery}
                      onChange={(e) => setSubBrandFilterQuery(e.target.value)}
                      className="h-8 text-xs pl-8 bg-slate-50 border-slate-200"
                    />
                    {subBrandFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setSubBrandFilterQuery("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Quick:</span>
                    {["Sigma", "Alpha", "Aljal", "Alka", "Elegance", "Orina", "Concept", "Spark", "Vivo", "Matrix", "Commander", "Classic", "Curv", "Sense"].map((qSb) => {
                      const isSel = selectedSubBrands.includes(qSb);
                      return (
                        <button
                          key={qSb}
                          type="button"
                          onClick={() => toggleArrayItem(selectedSubBrands, qSb, setSelectedSubBrands)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                            isSel
                              ? "bg-violet-600 text-white border-violet-600 shadow-2xs font-bold"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {isSel ? "✓ " : "+ "}{qSb}
                        </button>
                      );
                    })}
                  </div>

                  {/* Scrollable list of sub-brand chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {filteredSubBrandsList.map((sb) => {
                      const isSel = selectedSubBrands.includes(sb);
                      return (
                        <button
                          key={sb}
                          type="button"
                          onClick={() => toggleArrayItem(selectedSubBrands, sb, setSelectedSubBrands)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                            isSel
                              ? "bg-violet-600 text-white border-violet-600 shadow-2xs font-bold"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isSel && <Check className="w-3 h-3 text-white" />}
                          {sb}
                        </button>
                      );
                    })}
                    {filteredSubBrandsList.length === 0 && (
                      <span className="text-xs text-muted-foreground italic py-1">
                        No matching sub-brands found. You can add one below.
                      </span>
                    )}
                  </div>

                  {/* Custom Add Sub-Brand Input */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <Input
                      placeholder="+ Add custom sub-brand (e.g. Sense, Spark, Classic)..."
                      value={customSubBrandInput}
                      onChange={(e) => setCustomSubBrandInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customSubBrandInput.trim()) {
                          e.preventDefault();
                          const val = customSubBrandInput.trim();
                          toggleArrayItem(selectedSubBrands, val, setSelectedSubBrands);
                          setCustomSubBrandInput("");
                          toast.success(`Added & selected sub-brand: ${val}`);
                        }
                      }}
                      className="h-7 text-xs bg-slate-50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs shrink-0"
                      onClick={() => {
                        if (customSubBrandInput.trim()) {
                          const val = customSubBrandInput.trim();
                          toggleArrayItem(selectedSubBrands, val, setSelectedSubBrands);
                          setCustomSubBrandInput("");
                          toast.success(`Added & selected sub-brand: ${val}`);
                        }
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Attribute 4: Lengths / Sizes / Specs / Ratings (Searchable & Filter Tabs) */}
                <div className="space-y-3 p-4 rounded-xl border bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-emerald-600" /> 4. Lengths / Sizes / Specs / Ratings
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-bold">
                        {selectedSizes.length} Selected
                      </Badge>
                      {selectedSizes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSizes([])}
                          className="text-[11px] text-red-600 hover:underline font-medium"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Filter for Sizes */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Type to filter sizes (e.g. 100mm, 10A, 25 x 16mm)..."
                      value={sizeFilterQuery}
                      onChange={(e) => setSizeFilterQuery(e.target.value)}
                      className="h-8 text-xs pl-8 bg-slate-50 border-slate-200"
                    />
                    {sizeFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setSizeFilterQuery("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1 flex-wrap border-b pb-2">
                    {[
                      { id: "all", label: "All Specs" },
                      { id: "switches", label: "🔘 Switches (1G-4G, 13A)" },
                      { id: "lighting", label: "💡 Bulbs (5W-100W, E27)" },
                      { id: "breakers", label: "⚡ Breakers (6A-100A, 1P-4P)" },
                      { id: "cables", label: "🔌 Wires (1m, 100m, sqmm)" },
                      { id: "ties", label: "📏 Ties & Casing (mm)" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSizeFilterCategory(tab.id as any)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                          sizeFilterCategory === tab.id
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Scrollable list of size chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {filteredSizesList.map((sz) => {
                      const isSel = selectedSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => toggleArrayItem(selectedSizes, sz, setSelectedSizes)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                            isSel
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isSel ? "✓ " : "+ "}{sz}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Size Add */}
                  <div className="flex gap-2 items-center pt-1 border-t border-slate-100">
                    <Input
                      placeholder="+ Add custom size (e.g. 75m, 120A, 30W)..."
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customSizeInput.trim()) {
                          e.preventDefault();
                          toggleArrayItem(selectedSizes, customSizeInput.trim(), setSelectedSizes);
                          setCustomSizeInput("");
                        }
                      }}
                      className="h-7 text-xs bg-slate-50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs shrink-0"
                      onClick={() => {
                        if (customSizeInput.trim()) {
                          toggleArrayItem(selectedSizes, customSizeInput.trim(), setSelectedSizes);
                          setCustomSizeInput("");
                        }
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Pack Sizes, Colors, Features, Images */}
              <div className="space-y-6">
                {/* Attribute 5: Pack Sizes / Units */}
                <div className="space-y-3 p-4 rounded-xl border bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-600" /> 5. Pack Sizes / Units
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-xs font-bold">
                        {selectedPackSizes.length > 0
                          ? `${selectedPackSizes.length} Selected`
                          : `Default: ${defaultUnitOfMeasure || "Pcs"}`}
                      </Badge>
                      {selectedPackSizes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPackSizes([])}
                          className="text-[11px] text-red-600 hover:underline font-medium"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Filter for Pack Sizes */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Type to search pack sizes (e.g. 100, Pkt, Box, Coil)..."
                      value={packSizeFilterQuery}
                      onChange={(e) => setPackSizeFilterQuery(e.target.value)}
                      className="h-8 text-xs pl-8 bg-slate-50 border-slate-200"
                    />
                    {packSizeFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setPackSizeFilterQuery("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Quick:</span>
                    {["Pcs (1 pc)", "Pkt (100 Pcs)", "Pkt (50 Pcs)", "Box (10 Pcs)", "Box (50 Pcs)", "Box (100 Pcs)", "Box (1000 Pcs)", "Coil (100m)", "Bundle", "Carton"].map((qPs) => {
                      const isSel = selectedPackSizes.includes(qPs);
                      return (
                        <button
                          key={qPs}
                          type="button"
                          onClick={() => toggleArrayItem(selectedPackSizes, qPs, setSelectedPackSizes)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                            isSel
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-bold"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {isSel ? "✓ " : "+ "}{qPs}
                        </button>
                      );
                    })}
                  </div>

                  {/* Scrollable list of pack size chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {filteredPackSizesList.map((ps) => {
                      const isSel = selectedPackSizes.includes(ps);
                      return (
                        <button
                          key={ps}
                          type="button"
                          onClick={() => toggleArrayItem(selectedPackSizes, ps, setSelectedPackSizes)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                            isSel
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-bold"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isSel ? "✓ " : "+ "}{ps}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Pack Size Add */}
                  <div className="flex gap-2 items-center pt-1 border-t border-slate-100">
                    <Input
                      placeholder="+ Add custom pack size (e.g. Pkt (200 Pcs), Box (500 Pcs))..."
                      value={customPackSizeInput}
                      onChange={(e) => setCustomPackSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customPackSizeInput.trim()) {
                          e.preventDefault();
                          toggleArrayItem(selectedPackSizes, customPackSizeInput.trim(), setSelectedPackSizes);
                          setCustomPackSizeInput("");
                        }
                      }}
                      className="h-7 text-xs bg-slate-50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs shrink-0"
                      onClick={() => {
                        if (customPackSizeInput.trim()) {
                          toggleArrayItem(selectedPackSizes, customPackSizeInput.trim(), setSelectedPackSizes);
                          setCustomPackSizeInput("");
                        }
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Option: Include Pack Size in Product Name (Tic / Checkbox) */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/80 border border-blue-200">
                    <div className="space-y-0.5">
                      <Label htmlFor="include-pack-name-toggle" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${includePackInName ? "text-blue-600" : "text-slate-400"}`} />
                        Include Pack Size in Product Name
                      </Label>
                      <p className="text-[11px] text-slate-600">
                        {includePackInName
                          ? "✓ Ticked: Appended to name (e.g. \"China Cable Tie 2.5 x 100mm Black Pack\")"
                          : "Unticked: Name stays clean without pack suffix"}
                      </p>
                    </div>
                    <Checkbox
                      id="include-pack-name-toggle"
                      checked={includePackInName}
                      onCheckedChange={(val) => setIncludePackInName(!!val)}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </div>
                </div>

                {/* Attribute 6: Colors */}
                <div className="space-y-2.5 p-4 rounded-xl border bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-600" /> 6. Colors / Finishes
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {selectedColors.length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((col) => {
                      const isSel = selectedColors.includes(col.name);
                      return (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => toggleArrayItem(selectedColors, col.name, setSelectedColors)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-2 transition-all ${
                            isSel
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm font-semibold"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${col.bg} ${col.border || ""}`} />
                          {isSel ? "✓ " : ""}{col.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Attribute 7: Features / Special Grades */}
                <div className="space-y-2.5 p-4 rounded-xl border bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> 7. Features / Capacity / Sensitivity
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {selectedFeatures.length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_FEATURES.map((ft) => {
                      const isSel = selectedFeatures.includes(ft);
                      return (
                        <button
                          key={ft}
                          type="button"
                          onClick={() => toggleArrayItem(selectedFeatures, ft, setSelectedFeatures)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                            isSel
                              ? "bg-orange-600 text-white border-orange-600 shadow-sm font-semibold"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {isSel ? "✓ " : "+ "}{ft}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Attribute 8: IMAGES UPLOAD SECTION */}
                <div className="space-y-3 p-4 rounded-xl border bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-600" /> 8. Product Images
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono">{images.length}/6</span>
                  </div>

                  <div className="grid grid-cols-6 gap-2.5">
                    {showUploadSlot && (
                      <div
                        className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-blue-400 transition-all bg-white"
                        onClick={() => !uploading && fileInputRef.current?.click()}
                      >
                        {uploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                        ) : (
                          <Upload className="w-5 h-5 text-slate-400" />
                        )}
                        <span className="text-[10px] text-slate-400 mt-1 font-medium">Upload</span>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </div>
                    )}

                    {images.map((imgSrc, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-lg border bg-muted relative group overflow-hidden shadow-xs"
                      >
                        <img src={imgSrc} alt="Product" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {emptySlots.map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/15 bg-slate-100/50"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 Action Bar: Add Current Selection to Table */}
            <div className="p-4 rounded-xl border bg-blue-50/80 border-blue-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                    {livePreviewCombos.length > 0
                      ? `${livePreviewCombos.length} Variant(s) Ready to Add:`
                      : "Select Attributes Above:"}
                  </span>
                </div>

                {livePreviewCombos.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {livePreviewCombos.slice(0, 6).map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-white text-slate-900 border border-blue-200 shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {c.name}
                        {c.packSize && (
                          <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-1 rounded border border-blue-200">
                            {c.packSize}
                          </span>
                        )}
                      </span>
                    ))}
                    {livePreviewCombos.length > 6 && (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                        +{livePreviewCombos.length - 6} more variants
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pick a Supplier, Brand, Size, Pack Size, Color or Feature to see the preview and add to table.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearCurrentSelections}
                  disabled={livePreviewCombos.length === 0}
                  className="h-9 text-xs border-slate-300 hover:bg-white"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Clear Selection
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={addSelectionToTable}
                  disabled={livePreviewCombos.length === 0}
                  className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs px-4"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add to Table ({livePreviewCombos.length})
                </Button>
              </div>
            </div>

            {/* Staged Products Table (matrixRows) */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              <div className="bg-slate-900 text-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                      Staged Products Table
                      <Badge className="bg-emerald-600 text-white border-none text-[11px] font-mono px-2 py-0">
                        {matrixRows.length} Items Added
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      These are the exact products configured to proceed into Pricing (Step 3) and Save (Step 4).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {matrixRows.length > 0 && (
                    <>
                      <Badge className="bg-slate-800 text-emerald-400 border-slate-700 text-xs font-mono">
                        {matrixRows.filter((r) => r.existingProductId).length} Matches
                      </Badge>
                      <Badge className="bg-slate-800 text-blue-300 border-slate-700 text-xs font-mono">
                        {matrixRows.filter((r) => !r.existingProductId).length} New
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAllMatrixRows}
                        className="text-red-400 hover:text-red-300 hover:bg-red-950/40 text-xs h-7 px-2 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {matrixRows.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50/50">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Products Staged Yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Select your attributes above (e.g. Supplier, Brand, Size, Pack Size, Color) and click{" "}
                    <strong>&ldquo;+ Add to Table&rdquo;</strong>. You can repeat this to add different brands, sizes, pack sizes, and colors one by one!
                  </p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5 min-w-[200px]">Product Name</th>
                        <th className="p-2.5 min-w-[130px]">Brand / Supplier</th>
                        <th className="p-2.5 min-w-[85px]">Size / Spec</th>
                        <th className="p-2.5 min-w-[120px]">Pack Size / Unit</th>
                        <th className="p-2.5 min-w-[85px]">Color / Finish</th>
                        <th className="p-2.5 min-w-[95px]">Feature</th>
                        <th className="p-2.5 min-w-[130px]">Database Match Status</th>
                        <th className="p-2.5 w-10 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matrixRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">
                            {row.name}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-slate-800">{row.brand || "—"}</span>
                              {row.subBrand && (
                                <Badge variant="outline" className="text-[10px] text-violet-700 bg-violet-50 border-violet-200 py-0 font-medium">
                                  {row.subBrand}
                                </Badge>
                              )}
                            </div>
                            {row.supplier && row.supplier !== row.brand && (
                              <span className="text-[10px] text-muted-foreground block">{row.supplier}</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <Badge variant="outline" className="text-[11px] font-bold text-emerald-700 bg-emerald-50/50">
                              {row.sizeSpec || "Standard"}
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            <select
                              value={row.unitOfMeasure}
                              onChange={(e) => updateMatrixRowField(row.id, "unitOfMeasure", e.target.value)}
                              className="h-7 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {allPackSizes.map((ps) => (
                                <option key={ps} value={ps}>
                                  {ps}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2.5">
                            {row.color ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {row.color}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {row.feature ? (
                              <Badge variant="outline" className="text-[10px] text-orange-700 bg-orange-50 border-orange-200">
                                {row.feature}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {row.existingProductId ? (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 w-fit">
                                <GitMerge className="w-2.5 h-2.5" /> SKU: {row.existingSku}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                                + New Product
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeMatrixRow(row.id)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t bg-slate-50/50 p-4">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back: Base Details
            </Button>
            <Button onClick={handleNextStep} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Next: Define Pricing ({matrixRows.length > 0 ? matrixRows.length : livePreviewCombos.length} items) <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ========================================================= */}
      {/* STEP 3: INDIVIDUAL VARIANT PRICING & STOCK RULES          */}
      {/* ========================================================= */}
      {currentStep === 3 && (
        <Card className="border-slate-200 shadow-sm w-full">
          <CardHeader className="pb-3 border-b bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  Step 3: Individual Variant Pricing & Stock
                </CardTitle>
                <CardDescription>
                  Set individual prices, stock quantities, and retail flags separately for each configured variant.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-white text-emerald-700 font-bold text-xs border-emerald-300 w-fit">
                {matrixRows.length} Product Variants Staged
              </Badge>
            </div>

            {/* Quick Bulk Pricing Helper in Step 3 */}
            <div className="mt-3 p-3 bg-white border rounded-lg grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5 items-end shadow-xs">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Bulk MRP</Label>
                <Input
                  type="number"
                  placeholder="MRP"
                  value={bulkMrp}
                  onChange={(e) => setBulkMrp(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Bulk Cost</Label>
                <Input
                  type="number"
                  placeholder="Cost"
                  value={bulkCost}
                  onChange={(e) => setBulkCost(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Bulk Selling</Label>
                <Input
                  type="number"
                  placeholder="Selling"
                  value={bulkSelling}
                  onChange={(e) => setBulkSelling(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-violet-700">Bulk Retail</Label>
                <Input
                  type="number"
                  placeholder="Retail"
                  value={bulkRetailPrice}
                  onChange={(e) => setBulkRetailPrice(e.target.value)}
                  className="h-8 text-xs border-violet-200 focus-visible:ring-violet-400"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Margin %</Label>
                <Input
                  type="number"
                  placeholder="15%"
                  value={bulkMarginPct}
                  onChange={(e) => setBulkMarginPct(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Comm (%)</Label>
                <Input
                  type="number"
                  placeholder="%"
                  value={bulkCommission}
                  onChange={(e) => setBulkCommission(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyBulkPricing}
                  className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-900 text-white font-medium"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                  Fill All ({matrixRows.length})
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            {matrixRows.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50/50 rounded-xl border">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Variants to Price</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please go back to Step 2 and add variants to the table.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="mt-3 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Step 2
                </Button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {matrixRows.map((row, idx) => {
                  const margin =
                    row.sellingPrice > 0 && row.costPrice > 0
                      ? Math.round(((row.sellingPrice - row.costPrice) / row.sellingPrice) * 10000) / 100
                      : 0;

                  return (
                    <div
                      key={row.id}
                      className="p-4 rounded-xl border bg-slate-50/70 hover:bg-slate-50 transition-colors shadow-xs space-y-3"
                    >
                      {/* Variant Header Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            {row.name}
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap ml-1">
                            <Badge variant="outline" className="text-[11px] font-semibold text-slate-800 bg-white">
                              {row.brand || "—"}
                            </Badge>
                            {row.subBrand && (
                              <Badge variant="outline" className="text-[11px] font-semibold text-violet-700 bg-violet-50 border-violet-200">
                                {row.subBrand}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[11px] font-bold text-emerald-700 bg-emerald-50">
                              {row.sizeSpec || "Standard"}
                            </Badge>
                            <Badge variant="outline" className="text-[11px] font-semibold text-blue-700 bg-blue-50 border-blue-200 flex items-center gap-1">
                              <Package className="w-3 h-3 text-blue-600" /> {row.unitOfMeasure || "Pcs"}
                            </Badge>
                            {row.color && (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                                {row.color}
                              </Badge>
                            )}
                            {row.feature && (
                              <Badge variant="outline" className="text-[10px] text-orange-700 bg-orange-50 border-orange-200">
                                {row.feature}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {row.existingProductId ? (
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                              <GitMerge className="w-2.5 h-2.5" /> SKU: {row.existingSku}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                              + New Product
                            </Badge>
                          )}

                          {margin > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-[11px]">
                              Margin: {margin}%
                            </Badge>
                          )}

                          <button
                            type="button"
                            onClick={() => removeMatrixRow(row.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                            title="Remove this variant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Pricing & Stock Inputs for this specific variant */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 pt-1 items-end">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Pack / Unit</Label>
                          <select
                            value={row.unitOfMeasure}
                            onChange={(e) => updateMatrixRowField(row.id, "unitOfMeasure", e.target.value)}
                            className="h-8 text-xs bg-white border border-slate-200 rounded px-1.5 font-medium text-slate-800 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {allPackSizes.map((ps) => (
                              <option key={ps} value={ps}>
                                {ps}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">MRP (LKR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.mrp || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "mrp", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Cost Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.costPrice || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "costPrice", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Selling Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.sellingPrice || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "sellingPrice", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs bg-white font-bold text-emerald-700 border-emerald-300"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-semibold text-slate-700">Retail Price</Label>
                            {row.retailOnly && (
                              <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1 rounded">
                                Retail
                              </span>
                            )}
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={row.sellingPrice ? String(row.sellingPrice) : "0.00"}
                            value={row.retailPrice || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "retailPrice", parseFloat(e.target.value) || 0)}
                            className={`h-8 text-xs bg-white font-semibold transition-all ${
                              row.retailOnly
                                ? "text-violet-700 border-violet-400 bg-violet-50/50 focus-visible:ring-violet-400 shadow-2xs"
                                : "text-slate-800"
                            }`}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Comm (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="%"
                            value={row.commissionValue || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "commissionValue", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Stock Qty</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={row.stock || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "stock", parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Min Stock</Label>
                          <Input
                            type="number"
                            placeholder="5"
                            value={row.minStock || ""}
                            onChange={(e) => updateMatrixRowField(row.id, "minStock", parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-xs bg-white"
                          />
                        </div>

                        <div className="flex flex-col items-center justify-center pb-0.5 px-1 space-y-1 bg-white p-1.5 rounded-lg border border-slate-200">
                          <Label className="text-[10px] font-bold text-slate-700 cursor-pointer uppercase tracking-wider">
                            Retail Only
                          </Label>
                          <Switch
                            checked={row.retailOnly}
                            onCheckedChange={(val) => updateMatrixRowField(row.id, "retailOnly", val)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t bg-slate-50/50 p-4">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back: Attributes
            </Button>
            <Button
              onClick={handleNextStep}
              disabled={matrixRows.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Review Matrix & Save ({matrixRows.length} items) <Sparkles className="w-4 h-4 ml-1.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ========================================================= */}
      {/* STEP 4: MATRIX REVIEW, MERGE & SAVE                       */}
      {/* ========================================================= */}
      {currentStep === 4 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="pb-3 border-b bg-slate-50/70">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                  4
                </span>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    Step 4: Matrix Review & Product Merge ({enabledCount} active)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Fine-tune prices, review automatic matches with existing catalog products, and safely save without altering invoices or stock ledger.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search matrix by name, SKU, brand..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-64 h-9 text-xs"
                />
              </div>
            </div>

            {/* Merge Status Overview Banner */}
            <div className="mt-3 p-3 rounded-lg bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-blue-900">
                <GitMerge className="w-4 h-4 text-blue-600" />
                <span>
                  <strong>{mergedCount} existing catalog items matched</strong> (will standardize names/prices while preserving historical transactions) and <strong>{newCount} new products</strong> will be created.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(3)}
                className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Adjust Pricing Step
              </Button>
            </div>

            {/* Quick Group Tabs (Filter by Size or All) */}
            {matrixSizes.length > 1 && (
              <div className="flex items-center gap-1.5 pt-3 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mr-1">
                  Filter by Size:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveGroupFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                    activeGroupFilter === "all"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  All ({matrixRows.length})
                </button>
                {matrixSizes.map((sz) => {
                  const count = matrixRows.filter((r) => r.sizeSpec === sz).length;
                  const isSel = activeGroupFilter === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setActiveGroupFilter(sz)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                        isSel
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {sz} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick Bulk Toolbar */}
            <div className="mt-3 p-3 bg-white border rounded-lg grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5 items-end shadow-xs">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  {activeGroupFilter !== "all" ? `Set ${activeGroupFilter} MRP` : "Bulk MRP"}
                </Label>
                <Input
                  type="number"
                  placeholder="MRP"
                  value={bulkMrp}
                  onChange={(e) => setBulkMrp(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  {activeGroupFilter !== "all" ? `Set ${activeGroupFilter} Cost` : "Bulk Cost"}
                </Label>
                <Input
                  type="number"
                  placeholder="Cost"
                  value={bulkCost}
                  onChange={(e) => setBulkCost(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  {activeGroupFilter !== "all" ? `Set ${activeGroupFilter} Selling` : "Bulk Selling"}
                </Label>
                <Input
                  type="number"
                  placeholder="Selling"
                  value={bulkSelling}
                  onChange={(e) => setBulkSelling(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-violet-700">
                  {activeGroupFilter !== "all" ? `Set ${activeGroupFilter} Retail` : "Bulk Retail"}
                </Label>
                <Input
                  type="number"
                  placeholder="Retail"
                  value={bulkRetailPrice}
                  onChange={(e) => setBulkRetailPrice(e.target.value)}
                  className="h-8 text-xs border-violet-200 focus-visible:ring-violet-400"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Margin %</Label>
                <Input
                  type="number"
                  placeholder="15%"
                  value={bulkMarginPct}
                  onChange={(e) => setBulkMarginPct(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Comm (%)</Label>
                <Input
                  type="number"
                  placeholder="%"
                  value={bulkCommission}
                  onChange={(e) => setBulkCommission(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Button
                  size="sm"
                  onClick={applyBulkPricing}
                  className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-900 text-white"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                  {activeGroupFilter !== "all" ? `Apply to [${activeGroupFilter}]` : "Apply to All"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <Checkbox
                        checked={filteredRows.length > 0 && filteredRows.every((r) => r.enabled)}
                        onCheckedChange={(val) =>
                          setMatrixRows((prev) =>
                            prev.map((r) => {
                              const match = filteredRows.some((fr) => fr.id === r.id);
                              return match ? { ...r, enabled: !!val } : r;
                            })
                          )
                        }
                      />
                    </th>
                    <th className="p-3 min-w-[280px]">Product Name & Database Match</th>
                    <th className="p-3 min-w-[120px]">Brand</th>
                    <th className="p-3 min-w-[120px]">Supplier</th>
                    <th className="p-3 min-w-[100px]">Spec / Size</th>
                    <th className="p-3 min-w-[120px]">Pack Size / Unit</th>
                    <th className="p-3 min-w-[110px]">Color / Feature</th>
                    <th className="p-3 min-w-[110px]">MRP (LKR)</th>
                    <th className="p-3 min-w-[110px]">Cost Price</th>
                    <th className="p-3 min-w-[110px]">Selling Price</th>
                    <th className="p-3 min-w-[110px]">Retail Price</th>
                    <th className="p-3 min-w-[85px]">Margin</th>
                    <th className="p-3 min-w-[85px]">Comm %</th>
                    <th className="p-3 min-w-[85px] text-center">Retail Only</th>
                    <th className="p-3 min-w-[85px]">Stock</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => {
                    const margin =
                      row.sellingPrice > 0 && row.costPrice > 0
                        ? Math.round(((row.sellingPrice - row.costPrice) / row.sellingPrice) * 10000) / 100
                        : 0;

                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !row.enabled ? "opacity-35 bg-slate-50" : ""
                        }`}
                      >
                        <td className="p-3 text-center">
                          <Checkbox
                            checked={row.enabled}
                            onCheckedChange={(val) =>
                              setMatrixRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, enabled: !!val } : r))
                              )
                            }
                          />
                        </td>
                        <td className="p-3 space-y-1">
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r))
                              )
                            }
                            className="h-8 text-xs font-semibold"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {row.existingProductId ? (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                                <GitMerge className="w-2.5 h-2.5" /> Merging into SKU: {row.existingSku}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                + New Product
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="font-semibold text-slate-800 bg-slate-50 w-fit">
                              {row.brand || "—"}
                            </Badge>
                            {row.subBrand && (
                              <Badge variant="outline" className="text-[10px] font-semibold text-violet-700 bg-violet-50 border-violet-200 w-fit py-0">
                                {row.subBrand}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-[11px] text-slate-600 font-medium">
                            {row.supplier || "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[11px] bg-slate-50 font-bold text-emerald-700">
                            {row.sizeSpec || "Standard"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <select
                            value={row.unitOfMeasure}
                            onChange={(e) => updateMatrixRowField(row.id, "unitOfMeasure", e.target.value)}
                            className="h-8 text-xs bg-white border border-slate-200 rounded px-1.5 font-medium text-slate-800 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {allPackSizes.map((ps) => (
                              <option key={ps} value={ps}>
                                {ps}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {row.color && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {row.color}
                              </Badge>
                            )}
                            {row.feature && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 bg-orange-50 border-orange-200">
                                {row.feature}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.mrp || ""}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, mrp: parseFloat(e.target.value) || 0 } : r
                                )
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.costPrice || ""}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, costPrice: parseFloat(e.target.value) || 0 } : r
                                )
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.sellingPrice || ""}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) => {
                                  if (r.id !== row.id) return r;
                                  const sp = parseFloat(e.target.value) || 0;
                                  return {
                                    ...r,
                                    sellingPrice: sp,
                                    retailPrice: r.retailOnly && (!r.retailPrice || r.retailPrice === r.sellingPrice) ? sp : r.retailPrice,
                                  };
                                })
                              )
                            }
                            className="h-8 text-xs font-semibold text-emerald-700 border-emerald-300 focus-visible:ring-emerald-400"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.retailPrice || ""}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, retailPrice: parseFloat(e.target.value) || 0 } : r
                                )
                              )
                            }
                            className={`h-8 text-xs font-semibold ${
                              row.retailOnly
                                ? "text-violet-700 border-violet-400 bg-violet-50/50"
                                : "text-slate-800"
                            }`}
                            placeholder={row.sellingPrice ? String(row.sellingPrice) : "0.00"}
                          />
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              margin >= 15
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold"
                                : margin > 0
                                ? "text-amber-700 bg-amber-50 border-amber-200"
                                : "text-red-700 bg-red-50 border-red-200"
                            }`}
                          >
                            {margin}%
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.commissionValue || ""}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, commissionValue: parseFloat(e.target.value) || 0 } : r
                                )
                              )
                            }
                            className="h-8 text-xs w-16"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Switch
                            checked={row.retailOnly}
                            onCheckedChange={(val) =>
                              setMatrixRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        retailOnly: val,
                                        retailPrice: val ? r.sellingPrice : 0,
                                      }
                                    : r
                                )
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={row.stock || ""}
                            onChange={(e) =>
                              setMatrixRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, stock: parseFloat(e.target.value) || 0 } : r
                                )
                              )
                            }
                            className="h-8 text-xs w-16"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMatrixRows(matrixRows.filter((r) => r.id !== row.id))}
                            className="h-7 w-7 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer Stats */}
            <div className="p-4 border-t bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                <span>
                  Total Rows: <strong className="text-slate-900">{matrixRows.length}</strong>
                </span>
                <span>•</span>
                <span>
                  New to Create: <strong className="text-emerald-600">{newCount}</strong>
                </span>
                <span>•</span>
                <span>
                  Existing to Merge: <strong className="text-blue-600">{mergedCount}</strong>
                </span>
                {images.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-slate-700">📷 {images.length} images attached</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs h-9"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Edit Pricing
                </Button>
                <Button
                  onClick={handleSaveToCatalog}
                  disabled={isSaving || enabledCount === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-5 shadow-sm"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save & Merge {enabledCount} Products
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
