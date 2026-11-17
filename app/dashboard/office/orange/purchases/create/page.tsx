"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Factory,
  RefreshCcw,
  X,
  Search,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Check,
} from "lucide-react";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { ProductDialogs } from "../../products/_components/ProductDialogs";
import { ProductFormData } from "../../products/types";
import { SupplierDialogs } from "../../suppliers/_components/SupplierDialogs";
import { SupplierFormData } from "../../suppliers/types";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// --- Types ---

interface Product {
  id: string;
  sku: string;
  companyCode?: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  mrp: number;
  stock: number;
  unitOfMeasure: string;
  supplier: string;
}

interface Supplier {
  id: string;
  name: string;
}

// One invoice line as printed on the Orel bill.
//   listPrice (invoice "Unit Price") = MRP
//   listPrice − line Disc % (UDF, e.g. 30%)            = Selling Price
//   Selling − Distributor Margin % − RD %               = Cost Price (bill price)
//   Cost − Cash % − Additional %  (bill extra discount) = Actual Cost
interface BillLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  listPrice: number;
  discountPercent: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sellingOf = (l: { listPrice: number; discountPercent: number }) =>
  round2(l.listPrice * (1 - l.discountPercent / 100));

// Line Disc % that turns a product's MRP into its current selling price (e.g. 30)
const impliedDiscount = (mrp: number, selling: number) =>
  mrp > 0 && selling > 0 && selling < mrp ? round2((1 - selling / mrp) * 100) : 0;

const PCT_STORAGE_KEY = "orange-bill-discount-pcts";

// A line read from a scanned invoice, waiting for the user to confirm it
interface ScanRow {
  key: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  discountPercent: number | string;
  productId: string;
  matchedBy: "code" | "name" | "manual" | "";
  saveCode: boolean;
}

interface ScanSummary {
  grossAmount: number | null;
  udfDiscount: number | null;
  totalAmount: number | null;
}

const parseNumber = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return 0;
  return Number(val);
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const normCode = (s?: string | null) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const nameTokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9./]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 2 && t !== "orange");

// Find the product for an invoice line: exact item code, then a unique code prefix,
// then the closest product name (flagged so the user double-checks it).
function matchProduct(
  products: Product[],
  itemCode: string,
  description: string,
): { productId: string; matchedBy: ScanRow["matchedBy"] } {
  const code = normCode(itemCode);
  if (code) {
    const exact = products.find(
      (p) => normCode(p.companyCode) === code || normCode(p.sku) === code,
    );
    if (exact) return { productId: exact.id, matchedBy: "code" };

    const prefix = products.filter((p) => {
      const pc = normCode(p.companyCode);
      return pc.length >= 6 && (code.startsWith(pc) || pc.startsWith(code));
    });
    if (prefix.length === 1) return { productId: prefix[0].id, matchedBy: "code" };
  }

  const want = nameTokens(description);
  if (want.length > 0) {
    let best: Product | null = null;
    let bestScore = 0;
    for (const p of products) {
      const have = new Set(nameTokens(p.name));
      const hits = want.filter((t) => have.has(t)).length;
      const score = hits / want.length;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best && bestScore >= 0.6) return { productId: best.id, matchedBy: "name" };
  }
  return { productId: "", matchedBy: "" };
}

// Shrink phone photos so the upload stays small (Vercel body limit) but readable.
async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    return blob || file;
  } catch {
    return file; // e.g. HEIC the browser can't decode — send as-is
  }
}

export default function CreateOrangePurchasePage() {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- Inline Product Creation State ---
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id?: string }[]>([]);
  const [supplierCategories, setSupplierCategories] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    sku: "",
    companyCode: "",
    name: "Orange ",
    category: "",
    subCategory: "",
    brand: "",
    subBrand: "",
    modelType: "",
    subModel: "",
    sizeSpec: "",
    supplier: "Orange (Orel Corporation)",
    stock: "0",
    minStock: "0",
    mrp: "",
    sellingPrice: "",
    costPrice: "",
    images: [],
    unitOfMeasure: "Pcs",
    isActive: true,
  });

  // --- Inline Supplier Creation State ---
  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState<SupplierFormData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    status: "Active",
    duePayment: 0,
    businessId: BUSINESS_IDS.ORANGE_AGENCY,
  });
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Context State
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [currentBusinessName, setCurrentBusinessName] = useState<string>("");

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Form States
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [arrivalDate, setArrivalDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Invoice footer discounts as PERCENTAGES, applied one after another like the Orel invoice:
  // Subtotal → −Distributor Margin % → −Cash % → −RD % → −Additional %.
  // "UDF Discount" is the per-line Disc %, so it is not entered here.
  const [dmPct, setDmPct] = useState<number | string>("");
  const [cashPct, setCashPct] = useState<number | string>("");
  const [rdPct, setRdPct] = useState<number | string>("");
  const [addPct, setAddPct] = useState<number | string>("");
  const [invoiceTotal, setInvoiceTotal] = useState<number | string>("");

  // Remember the last used percentages (they rarely change between Orel bills)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PCT_STORAGE_KEY) || "null");
      if (saved) {
        setDmPct(saved.dm ?? "");
        setCashPct(saved.cash ?? "");
        setRdPct(saved.rd ?? "");
        setAddPct(saved.add ?? "");
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        PCT_STORAGE_KEY,
        JSON.stringify({ dm: dmPct, cash: cashPct, rd: rdPct, add: addPct }),
      );
    } catch {}
  }, [dmPct, cashPct, rdPct, addPct]);

  // Items State
  const [items, setItems] = useState<BillLine[]>([]);

  // Invoice scan state
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanRows, setScanRows] = useState<ScanRow[] | null>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [scanFooter, setScanFooter] = useState<{
    invoiceNumber: string;
    invoiceDate: string;
    distributorMargin: number | null;
    cashDiscount: number | null;
    rdDiscount: number | null;
    additionalDiscount: number | null;
  } | null>(null);

  // --- Dropdown States ---
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Input Refs for Fast Data Entry
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Current Item Edit State
  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    quantity: number | string;
    freeQuantity: number | string;
    unitPrice: number | string; // invoice Unit Price (= MRP)
    discountPercent: number | string;
    unit: string;
  }>({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    unitPrice: "",
    discountPercent: "",
    unit: "",
  });

  // --- 1. Get User Context ---
  useEffect(() => {
    const user = getUserBusinessContext();
    if (!user) {
      toast.error("Session not found. Please log in again.");
      router.push("/login");
    } else {
      setCurrentBusinessId(BUSINESS_IDS.ORANGE_AGENCY);
      setCurrentBusinessName(user.businessName ?? "Orange Agency");
    }
  }, [router]);

  // --- 2. Fetch Data Function ---
  const loadData = async () => {
    if (!currentBusinessId) return;
    setLoadingData(true);
    try {
      const [prodRes, supRes, catRes, supCatRes] = await Promise.all([
        fetch("/api/products?active=true"),
        fetch(`/api/suppliers?businessId=${currentBusinessId}`),
        fetch("/api/settings/categories?type=category"),
        fetch("/api/settings/categories?type=supplier"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (supCatRes.ok) setSupplierCategories(await supCatRes.json());

      if (prodRes.ok) {
        const allProducts: Product[] = await prodRes.json();
        const orangeProducts = allProducts.filter((p) =>
          p.supplier?.toLowerCase().includes("orange")
        );
        setProducts(orangeProducts);
      } else {
        toast.error("Failed to load products");
      }

      if (supRes.ok) {
        const supplierData = await supRes.json();
        setSuppliers(supplierData);
        const orangeSupplier = supplierData.find((s: Supplier) =>
          s.name.toLowerCase().includes("orange")
        );
        if (orangeSupplier) {
          setSupplierId(orangeSupplier.id);
        } else if (supplierData.length === 1) {
          setSupplierId(supplierData[0].id);
        }
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBusinessId]);

  // --- Close Dropdown on Click Outside ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Global Keyboard Shortcuts (Shift+F to focus search) ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // --- Handlers ---
  const handleSupplierChange = (newSupplierId: string) =>
    setSupplierId(newSupplierId);

  const handleProductSelect = (product: Product) => {
    setCurrentItem({
      ...currentItem,
      productId: product.id,
      sku: product.sku,
      // Invoice Unit Price = MRP; Disc % is whatever turns MRP into the current selling price
      unitPrice: product.mrp > 0 ? product.mrp : "",
      discountPercent: impliedDiscount(product.mrp, product.sellingPrice) || "",
      freeQuantity: "",
      quantity: "",
      unit: product.unitOfMeasure || "Pcs",
    });
    setSearchTerm(product.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => {
      qtyInputRef.current?.focus({ preventScroll: true });
    }, 100);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredProducts.length - 1 ? prev + 1 : prev;
        itemRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : prev;
        itemRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        handleProductSelect(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleAddItem = () => {
    const qty = parseNumber(currentItem.quantity);
    const unitPrice = parseNumber(currentItem.unitPrice);

    if (!currentItem.productId || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (unitPrice <= 0) {
      toast.error("Enter the invoice Unit Price");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const newItem: BillLine = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
      freeQuantity: parseNumber(currentItem.freeQuantity),
      unit: currentItem.unit,
      listPrice: unitPrice,
      discountPercent: parseNumber(currentItem.discountPercent),
    };

    setItems([...items, newItem]);

    // Reset Form
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      unitPrice: "",
      discountPercent: "",
      unit: "",
    });
    setSearchTerm("");
  };

  const handleRemoveItem = (id: string) =>
    setItems(items.filter((item) => item.id !== id));

  // --- Inline edit of an added line ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    listPrice: number | string;
    discountPercent: number | string;
    quantity: number | string;
    freeQuantity: number | string;
  }>({ listPrice: "", discountPercent: "", quantity: "", freeQuantity: "" });

  const startEdit = (line: BillLine) => {
    setEditingId(line.id);
    setEditDraft({
      listPrice: line.listPrice,
      discountPercent: line.discountPercent,
      quantity: line.quantity,
      freeQuantity: line.freeQuantity || "",
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const qty = parseNumber(editDraft.quantity);
    const price = parseNumber(editDraft.listPrice);
    if (qty <= 0) return toast.error("Quantity must be more than 0");
    if (price <= 0) return toast.error("Enter the invoice Unit Price");
    setItems((prev) =>
      prev.map((l) =>
        l.id === editingId
          ? {
              ...l,
              quantity: qty,
              freeQuantity: parseNumber(editDraft.freeQuantity),
              listPrice: price,
              discountPercent: parseNumber(editDraft.discountPercent),
            }
          : l,
      ),
    );
    setEditingId(null);
  };

  const editKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  // --- Invoice Scan ---
  const handleScanFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 4);
    setScanning(true);
    try {
      const body = new FormData();
      for (const f of files) {
        const blob = await prepareImage(f);
        body.append("files", blob, f.name);
      }
      const res = await fetch("/api/purchases/scan-invoice", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      if (!data.items?.length) throw new Error("No items found on the invoice. Try a clearer photo.");

      const rows: ScanRow[] = data.items.map((it: any, idx: number) => {
        const m = matchProduct(products, it.itemCode, it.description);
        const product = products.find((p) => p.id === m.productId);
        return {
          key: `${Date.now()}-${idx}`,
          itemCode: it.itemCode || "",
          description: it.description || "",
          unit: it.unit || "",
          quantity: it.quantity || "",
          unitPrice: it.unitPrice || "",
          discountPercent: it.discountPercent ?? "",
          productId: m.productId,
          matchedBy: m.matchedBy,
          saveCode: !!it.itemCode && m.matchedBy !== "code" && !!product && !product.companyCode,
        };
      });
      setScanRows(rows);
      setScanSummary({
        grossAmount: data.summary?.grossAmount ?? null,
        udfDiscount: data.summary?.udfDiscount ?? null,
        totalAmount: data.summary?.totalAmount ?? null,
      });
      setScanFooter({
        invoiceNumber: data.invoiceNumber || "",
        invoiceDate: data.invoiceDate || "",
        distributorMargin: data.summary?.distributorMargin ?? null,
        cashDiscount: data.summary?.cashDiscount ?? null,
        rdDiscount: data.summary?.rdDiscount ?? null,
        additionalDiscount: data.summary?.additionalDiscount ?? null,
      });
      const unmatched = rows.filter((r) => !r.productId).length;
      toast.success(
        `Read ${rows.length} line(s).` +
          (unmatched ? ` ${unmatched} need a product selected.` : " Please check and add to bill."),
      );
    } catch (error: any) {
      toast.error(error.message || "Scan failed");
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  // After a product is created/refreshed, try matching the still-unmatched scanned lines again
  useEffect(() => {
    setScanRows((rows) => {
      if (!rows || !rows.some((r) => !r.productId)) return rows;
      return rows.map((r) => {
        if (r.productId) return r;
        const m = matchProduct(products, r.itemCode, r.description);
        return m.productId ? { ...r, ...m } : r;
      });
    });
  }, [products]);

  const updateScanRow = (key: string, patch: Partial<ScanRow>) =>
    setScanRows((rows) => rows && rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const openCreateFromScan = (row: ScanRow) => {
    setFormData((prev) => ({
      ...prev,
      name: `Orange ${row.description}`.trim(),
      companyCode: row.itemCode,
      costPrice: row.unitPrice === "" ? "" : String(row.unitPrice),
      unitOfMeasure: /rel|roll/i.test(row.unit) ? "Roll" : prev.unitOfMeasure,
    }));
    setIsAddDialogOpen(true);
  };

  const scanGross = (scanRows || []).reduce(
    (s, r) => s + parseNumber(r.quantity) * parseNumber(r.unitPrice),
    0,
  );
  const scanUdf = (scanRows || []).reduce(
    (s, r) =>
      s +
      (parseNumber(r.quantity) * parseNumber(r.unitPrice) * parseNumber(r.discountPercent)) / 100,
    0,
  );

  const handleAddScannedToBill = async () => {
    if (!scanRows) return;
    const missing = scanRows.filter((r) => !r.productId);
    if (missing.length > 0) {
      toast.error(`Select a product for ${missing.length} line(s) or remove them`);
      return;
    }
    const bad = scanRows.find((r) => parseNumber(r.quantity) <= 0);
    if (bad) {
      toast.error(`Check the quantity for ${bad.itemCode || bad.description}`);
      return;
    }

    const newItems: BillLine[] = scanRows.map((r, idx) => {
      const product = products.find((p) => p.id === r.productId)!;
      return {
        id: `${Date.now()}-${idx}`,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: parseNumber(r.quantity),
        freeQuantity: 0,
        unit: product.unitOfMeasure || "Pcs",
        listPrice: parseNumber(r.unitPrice),
        discountPercent: parseNumber(r.discountPercent),
      };
    });
    setItems((prev) => [...prev, ...newItems]);

    if (scanFooter) {
      if (scanFooter.invoiceNumber && !invoiceNumber) setInvoiceNumber(scanFooter.invoiceNumber);
      // Only trust a scanned date within ~1 year of today (guards against misread digits)
      const scannedMs = Date.parse(scanFooter.invoiceDate);
      if (scanFooter.invoiceDate && Math.abs(Date.now() - scannedMs) < 370 * 86400000) {
        setPurchaseDate(scanFooter.invoiceDate);
      } else if (scanFooter.invoiceDate) {
        toast.warning(`Scanned date ${scanFooter.invoiceDate} looks wrong — please set Bill Date manually`);
      }
      // The invoice prints amounts; each is a % of what remained after the previous one.
      // Convert back to percentages in the same order (DM → Cash → RD → Additional).
      let base =
        (scanSummary?.grossAmount ?? scanGross) - (scanSummary?.udfDiscount ?? scanUdf);
      const toPct = (amt: number | null, set: (v: number | string) => void) => {
        if (amt === null || amt === undefined || base <= 0) return;
        set(round2((amt / base) * 100));
        base -= amt;
      };
      toPct(scanFooter.distributorMargin, setDmPct);
      toPct(scanFooter.cashDiscount, setCashPct);
      toPct(scanFooter.rdDiscount, setRdPct);
      toPct(scanFooter.additionalDiscount, setAddPct);
    }
    if (scanSummary?.totalAmount) {
      setInvoiceTotal((c) => parseNumber(c) + (scanSummary.totalAmount || 0));
    }

    // Remember invoice item codes on products that had none, so next scan matches by code
    const toSave = new Map<string, string>();
    for (const r of scanRows) {
      if (r.saveCode && r.itemCode && !toSave.has(r.productId)) toSave.set(r.productId, r.itemCode);
    }
    setScanRows(null);
    setScanSummary(null);
    setScanFooter(null);
    toast.success(`${newItems.length} item(s) added. Check the totals against the invoice.`);

    if (toSave.size > 0) {
      const results = await Promise.all(
        Array.from(toSave.entries()).map(([id, code]) =>
          fetch(`/api/products/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyCode: code }),
          }).then((r) => r.ok),
        ),
      );
      const failed = results.filter((ok) => !ok).length;
      if (failed > 0) toast.warning(`Could not save item code on ${failed} product(s)`);
      setProducts((prev) =>
        prev.map((p) => (toSave.has(p.id) && !p.companyCode ? { ...p, companyCode: toSave.get(p.id) } : p)),
      );
    }
  };

  // --- Bill Calculations ---
  // Same order as the Orel invoice footer; each % applies to what is left after the previous.
  const dm = parseNumber(dmPct) / 100;
  const cash = parseNumber(cashPct) / 100;
  const rd = parseNumber(rdPct) / 100;
  const addl = parseNumber(addPct) / 100;

  // Distributor Margin + RD are trade discounts → they make the Cost Price.
  // Cash + Additional are the bill's extra discount → they lower the Actual Cost.
  const costFactor = (1 - dm) * (1 - rd);
  const costOf = (l: BillLine) => round2(sellingOf(l) * costFactor);
  const actualCostOf = (l: BillLine) => sellingOf(l) * costFactor * (1 - cash) * (1 - addl);

  const totalGross = items.reduce((sum, l) => sum + l.listPrice * l.quantity, 0);
  const subtotal = items.reduce((sum, l) => sum + sellingOf(l) * l.quantity, 0);
  const totalLineDiscount = totalGross - subtotal;
  const dmAmount = subtotal * dm;
  const cashAmount = (subtotal - dmAmount) * cash;
  const rdAmount = (subtotal - dmAmount - cashAmount) * rd;
  const addAmount = (subtotal - dmAmount - cashAmount - rdAmount) * addl;
  const finalTotal = subtotal - dmAmount - cashAmount - rdAmount - addAmount;

  // What gets saved: each line at Cost Price, the rest (Cash + Additional) as extra discount.
  const costTotal = items.reduce((sum, l) => sum + costOf(l) * l.quantity, 0);
  const extraDiscountAmount = Math.max(0, costTotal - finalTotal);
  const extraDiscountPercent = costTotal > 0 ? (extraDiscountAmount / costTotal) * 100 : 0;

  // --- Product price changes this bill will apply (MRP / Selling / Cost) ---
  const productOf = (l: BillLine) => products.find((p) => p.id === l.productId);
  // Ignore differences under 5 cents (rounding)
  const changed = (oldV: number | undefined, newV: number) =>
    Math.abs((oldV || 0) - newV) >= 0.05;
  const wasBadge = (oldV: number | undefined, newV: number) => {
    if (!changed(oldV, newV)) return null;
    const old = oldV || 0;
    return (
      <div
        className={`text-[10px] font-medium ${newV > old ? "text-red-600" : "text-green-700"}`}
        title="Product price will be updated to this on save"
      >
        {old > 0 ? `was ${fmt(old)} ${newV > old ? "▲" : "▼"}` : "new price"}
      </div>
    );
  };
  const priceUpdates = Array.from(
    // last line per product wins (same as the server)
    new Map(items.map((l) => [l.productId, l])).values(),
  )
    .map((l) => {
      const p = productOf(l);
      return {
        id: l.productId,
        name: l.productName,
        mrp: { old: p?.mrp || 0, new: l.listPrice },
        selling: { old: p?.sellingPrice || 0, new: sellingOf(l) },
        cost: { old: p?.costPrice || 0, new: costOf(l) },
      };
    })
    .filter((u) => changed(u.mrp.old, u.mrp.new) || changed(u.selling.old, u.selling.new) || changed(u.cost.old, u.cost.new));
  const invoiceTotalNum = parseNumber(invoiceTotal);
  const totalDifference = invoiceTotalNum > 0 ? finalTotal - invoiceTotalNum : 0;
  const totalMatches = invoiceTotalNum > 0 && Math.abs(totalDifference) < 1;

  // --- Save Purchase ---
  const handleSavePurchase = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!supplierId) return toast.error("Select a supplier");
    if (!currentBusinessId) return toast.error("Business context missing");
    if (scanRows && scanRows.length > 0) {
      return toast.error("Add or discard the scanned invoice lines first");
    }
    if (editingId) {
      return toast.error("Finish editing the line first (press Enter or ✓)");
    }
    if (invoiceTotalNum > 0 && !totalMatches) {
      const ok = window.confirm(
        `Bill total LKR ${fmt(finalTotal)} does not match the invoice total LKR ${fmt(invoiceTotalNum)} ` +
          `(difference ${fmt(totalDifference)}). Save anyway?`,
      );
      if (!ok) return;
    }

    setSubmitting(true);
    const purchasePayload = {
      supplier_id: supplierId,
      business_id: currentBusinessId,
      purchase_date: purchaseDate,
      arrival_date: arrivalDate || "",
      invoice_number: invoiceNumber || "",
      total_amount: finalTotal,
      extra_discount: extraDiscountAmount,
      extra_discount_percent: extraDiscountPercent,
      items: items.map((l) => {
        const cost = costOf(l);
        return {
          productId: l.productId,
          quantity: l.quantity,
          freeQuantity: l.freeQuantity,
          unitPrice: cost, // bill price → products.cost_price
          mrp: l.listPrice, // invoice Unit Price → products.mrp
          sellingPrice: sellingOf(l), // MRP − line Disc % → products.selling_price
          discountPercent: 0,
          discountAmount: 0,
          finalPrice: cost,
          total: cost * l.quantity,
        };
      }),
    };

    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchasePayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create purchase");
      toast.success(
        priceUpdates.length > 0
          ? `Bill created. Prices updated for ${priceUpdates.length} product(s).`
          : "Bill Created Successfully!",
      );
      router.push("/dashboard/office/orange/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Create Product inline ---
  const handleCreateProduct = async () => {
    if (!formData.name || !formData.category) {
      toast.error("Please fill required fields (Name, Category)");
      return;
    }

    setSubmittingProduct(true);
    const payload = {
      ...formData,
      supplier: suppliers.find((s) => s.id === supplierId)?.name || "Orange (Orel Corporation)",
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      mrp: Number(formData.mrp) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      costPrice: Number(formData.costPrice) || 0,
    };

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Operation failed");

      toast.success("Product created successfully!");
      setIsAddDialogOpen(false);
      setFormData({
        sku: "",
        companyCode: "",
        name: "Orange ",
        category: "",
        subCategory: "",
        brand: "",
        subBrand: "",
        modelType: "",
        subModel: "",
        sizeSpec: "",
        supplier: "Orange (Orel Corporation)",
        stock: "0",
        minStock: "0",
        mrp: "",
        sellingPrice: "",
        costPrice: "",
        images: [],
        unitOfMeasure: "Pcs",
        isActive: true,
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmittingProduct(false);
    }
  };

  // --- Create Supplier inline ---
  const handleCreateSupplier = async () => {
    if (!supplierFormData.name || !supplierFormData.contactPerson || !supplierFormData.phone) {
      toast.error("Please fill in required fields (Name, Contact, Phone)");
      return;
    }

    setSubmittingSupplier(true);
    const payload = {
      ...supplierFormData,
      businessId: BUSINESS_IDS.ORANGE_AGENCY,
    };

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create supplier");

      toast.success("Supplier created successfully!");
      setIsAddSupplierDialogOpen(false);
      setSupplierFormData({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        category: "",
        status: "Active",
        duePayment: 0,
        businessId: BUSINESS_IDS.ORANGE_AGENCY,
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (searchTerm === "") return true;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    for (const word of searchWords) {
      const pName = p.name ? p.name.toLowerCase() : "";
      const pSku = p.sku ? p.sku.toLowerCase() : "";
      const pCode = p.companyCode ? p.companyCode.toLowerCase() : "";
      if (!pName.includes(word) && !pSku.includes(word) && !pCode.includes(word)) {
        return false;
      }
    }
    return true;
  });

  const currentSelling = sellingOf({
    listPrice: parseNumber(currentItem.unitPrice),
    discountPercent: parseNumber(currentItem.discountPercent),
  });
  const currentCost = round2(currentSelling * costFactor);

  if (loadingData) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/office/orange/purchases")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-orange-900">
            New Bill
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new bill for {currentBusinessName}
          </p>
        </div>
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleScanFiles(e.target.files)}
        />
        <Button
          variant="outline"
          onClick={() => scanInputRef.current?.click()}
          disabled={scanning}
          className="border-orange-300 text-orange-700 hover:bg-orange-50"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ScanLine className="w-4 h-4 mr-2" />
          )}
          {scanning ? "Reading invoice..." : "Scan Invoice"}
        </Button>
        <Button
          onClick={handleSavePurchase}
          disabled={items.length === 0 || submitting}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Bill
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-3">
          {/* Bill Details */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-orange-600" /> Bill Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Supplier</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs text-orange-600 hover:text-orange-700 hover:bg-transparent"
                      type="button"
                      onClick={() => setIsAddSupplierDialogOpen(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> New
                    </Button>
                  </div>
                  <Select
                    value={supplierId || ""}
                    onValueChange={handleSupplierChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Bill Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice">Invoice Number</Label>
                  <Input
                    id="invoice"
                    placeholder="Enter Invoice No"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalDate">Arrival Date</Label>
                  <Input
                    id="arrivalDate"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scanned invoice review */}
          {scanRows && (
            <Card className="border-orange-300 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between gap-2 bg-orange-50/50">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-orange-600" /> Scanned Invoice
                    {scanFooter?.invoiceNumber && (
                      <span className="text-sm font-normal text-muted-foreground">
                        #{scanFooter.invoiceNumber}
                        {scanFooter.invoiceDate && ` · ${scanFooter.invoiceDate}`}
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check each line against the paper invoice, fix anything wrong, then add to bill.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setScanRows(null);
                      setScanSummary(null);
                      setScanFooter(null);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={handleAddScannedToBill}
                    disabled={scanRows.length === 0}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add {scanRows.length} to Bill
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {scanRows.map((row) => {
                  const product = products.find((p) => p.id === row.productId);
                  const lastCost = product?.costPrice || 0;
                  const priceChanged =
                    !!product && lastCost > 0 && Math.abs(lastCost - parseNumber(row.unitPrice)) >= 0.01;
                  return (
                    <div
                      key={row.key}
                      className={`rounded-md border p-3 space-y-2 ${
                        !row.productId
                          ? "border-red-300 bg-red-50/40"
                          : row.matchedBy === "name"
                            ? "border-amber-300 bg-amber-50/40"
                            : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs">
                          <span className="font-mono font-semibold">{row.itemCode || "—"}</span>
                          <span className="text-muted-foreground"> · {row.description}</span>
                          {row.unit && <span className="text-muted-foreground"> · {row.unit}</span>}
                        </div>
                        <button
                          onClick={() => setScanRows((rows) => rows && rows.filter((r) => r.key !== row.key))}
                          className="text-muted-foreground hover:text-red-600"
                          title="Remove line"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                        <div className="col-span-2 md:col-span-6">
                          <Label className="text-xs mb-1 block">
                            Product{" "}
                            {row.matchedBy === "code" && (
                              <span className="text-green-600">(matched by code)</span>
                            )}
                            {row.matchedBy === "name" && (
                              <span className="text-amber-600">(guessed by name — please check)</span>
                            )}
                            {!row.productId && <span className="text-red-600">(not found — select)</span>}
                          </Label>
                          <div className="flex gap-1">
                            <SearchableDropdown
                              options={products.map((p) => ({
                                id: p.id,
                                name: p.name,
                                info: [p.sku, p.companyCode].filter(Boolean).join(" · "),
                              }))}
                              value={row.productId}
                              onChange={(id) => {
                                const p = products.find((x) => x.id === id);
                                updateScanRow(row.key, {
                                  productId: id,
                                  matchedBy: "manual",
                                  saveCode: !!row.itemCode && !!p && !p.companyCode,
                                });
                              }}
                              placeholder="Select product..."
                              className="[&>div>div]:h-9"
                            />
                            {!row.productId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 shrink-0 border-dashed border-orange-300 text-orange-600"
                                onClick={() => openCreateFromScan(row)}
                                title="Create this as a new product"
                              >
                                <Plus className="w-3 h-3 mr-1" /> New
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs mb-1 block">Qty</Label>
                          <Input
                            type="number"
                            min="0"
                            value={row.quantity}
                            onChange={(e) =>
                              updateScanRow(row.key, {
                                quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                              })
                            }
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs mb-1 block text-blue-600">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(e) =>
                              updateScanRow(row.key, {
                                unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                              })
                            }
                            className="h-9 text-xs border-blue-200"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs mb-1 block">Disc %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={row.discountPercent}
                            onChange={(e) =>
                              updateScanRow(row.key, {
                                discountPercent: e.target.value === "" ? "" : parseFloat(e.target.value),
                              })
                            }
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="text-muted-foreground">
                          {priceChanged && (
                            <span className="text-amber-700">
                              Last cost was {fmt(lastCost)} — price changed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {row.itemCode && product && !product.companyCode && (
                            <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.saveCode}
                                onChange={(e) => updateScanRow(row.key, { saveCode: e.target.checked })}
                              />
                              Remember code {row.itemCode} for this product
                            </label>
                          )}
                          <span className="font-semibold">
                            Line: LKR{" "}
                            {fmt(
                              parseNumber(row.quantity) *
                                parseNumber(row.unitPrice) *
                                (1 - parseNumber(row.discountPercent) / 100),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Cross-check against the invoice totals */}
                {scanSummary && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    {[
                      { label: "Gross Amount", mine: scanGross, theirs: scanSummary.grossAmount },
                      { label: "UDF Discount", mine: scanUdf, theirs: scanSummary.udfDiscount },
                    ].map((c) => {
                      if (c.theirs === null || c.theirs === undefined) return null;
                      const ok = Math.abs(c.mine - c.theirs) < 1;
                      return (
                        <div
                          key={c.label}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                            ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
                          }`}
                        >
                          {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          <span>
                            {c.label}: {fmt(c.mine)}{" "}
                            {ok ? "matches invoice" : `≠ invoice ${fmt(c.theirs)} — check qty / price / %`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Add Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Items</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddDialogOpen(true)}
                  className="text-xs border-dashed border-orange-300 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  type="button"
                >
                  <Plus className="w-3 h-3 mr-1" /> New Item
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  className="text-xs"
                  type="button"
                >
                  <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Custom Searchable Dropdown */}
                <div className="w-full relative" ref={dropdownRef}>
                  <Label className="mb-2 block">
                    Product Search ({products.length} Orange products loaded) —{" "}
                    <span className="text-xs text-muted-foreground">Shift+F to focus</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Type product name or SKU..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                        setHighlightedIndex(-1);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={handleSearchKeyDown}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentItem((prev) => ({ ...prev, productId: "" }));
                          setHighlightedIndex(-1);
                        }}
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-black"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-sm text-center text-gray-500">
                          No products found
                        </div>
                      ) : (
                        filteredProducts.map((product, index) => (
                          <div
                            key={product.id}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 ${
                              highlightedIndex === index
                                ? "bg-orange-100"
                                : "hover:bg-orange-50"
                            }`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => handleProductSelect(product)}
                          >
                            <div className="font-medium text-sm text-gray-900 border-b border-gray-100 pb-1 mb-1">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-600 grid grid-cols-2 gap-1 font-medium">
                              <div>
                                <span className="text-gray-400 font-normal">Item Code:</span> {product.sku}
                              </div>
                              {product.companyCode && (
                                <div>
                                  <span className="text-gray-400 font-normal">Company Code:</span>{" "}
                                  <span className="text-blue-600">{product.companyCode}</span>
                                </div>
                              )}
                              <div className="col-span-2">
                                <span className="text-gray-400 font-normal">Supplier:</span>{" "}
                                {product.supplier || "No Supplier"}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Item Detail Fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Item Code</Label>
                    <Input
                      value={currentItem.sku || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Auto"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Unit</Label>
                    <Input
                      value={currentItem.unit || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Unit"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Quantity</Label>
                    <Input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantity: e.target.value === "" ? "" : parseInt(e.target.value),
                        })
                      }
                      onKeyDown={handleKeyDown}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-green-600">Free Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentItem.freeQuantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity: e.target.value === "" ? "" : parseInt(e.target.value),
                        })
                      }
                      onKeyDown={handleKeyDown}
                      className="h-9 border-green-200 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">Unit Price (MRP)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.unitPrice}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      onKeyDown={handleKeyDown}
                      className="h-9 border-blue-200 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={currentItem.discountPercent}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          discountPercent: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      onKeyDown={handleKeyDown}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-green-700">Selling Price</Label>
                    <Input
                      value={currentSelling > 0 ? fmt(currentSelling) : ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="MRP − Disc %"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-muted-foreground">Cost Price</Label>
                    <Input
                      value={currentCost > 0 ? fmt(currentCost) : ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Selling − DM − RD"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      onClick={handleAddItem}
                      className="w-full h-9 bg-orange-600 hover:bg-orange-700"
                      disabled={!currentItem.productId}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-orange-50/50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right text-green-700">Selling</TableHead>
                    <TableHead className="text-right text-blue-700">Cost</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Free</TableHead>
                    <TableHead className="text-right" title="Same as the invoice NET AMOUNT column">
                      Net Amount
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No items added
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((saved) => {
                      const isEditing = editingId === saved.id;
                      // While editing, all calculated columns follow the draft live
                      const item: BillLine = isEditing
                        ? {
                            ...saved,
                            listPrice: parseNumber(editDraft.listPrice),
                            discountPercent: parseNumber(editDraft.discountPercent),
                            quantity: parseNumber(editDraft.quantity),
                            freeQuantity: parseNumber(editDraft.freeQuantity),
                          }
                        : saved;
                      const editInput = (
                        field: keyof typeof editDraft,
                        width: string,
                        autoFocus = false,
                      ) => (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          autoFocus={autoFocus}
                          value={editDraft[field]}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              [field]: e.target.value === "" ? "" : parseFloat(e.target.value),
                            }))
                          }
                          onKeyDown={editKeyDown}
                          className={`h-8 ${width} ml-auto text-right text-xs`}
                        />
                      );
                      return (
                      <TableRow key={saved.id} className={isEditing ? "bg-orange-50/60" : ""}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? editInput("listPrice", "w-24") : fmt(item.listPrice)}
                          {wasBadge(productOf(item)?.mrp, item.listPrice)}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {isEditing
                            ? editInput("discountPercent", "w-16")
                            : item.discountPercent
                              ? `${item.discountPercent}%`
                              : "-"}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {fmt(sellingOf(item))}
                          {wasBadge(productOf(item)?.sellingPrice, sellingOf(item))}
                        </TableCell>
                        <TableCell className="text-right text-blue-700">
                          {fmt(costOf(item))}
                          {wasBadge(productOf(item)?.costPrice, costOf(item))}
                        </TableCell>
                        <TableCell
                          className="text-right text-muted-foreground"
                          title="After Cash + Additional discount (used for profit / FIFO)"
                        >
                          {fmt(actualCostOf(item))}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? editInput("quantity", "w-16", true) : item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {isEditing ? editInput("freeQuantity", "w-14") : item.freeQuantity || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold">{fmt(actualCostOf(item) * item.quantity)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Selling total {fmt(sellingOf(item) * item.quantity)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <Button variant="ghost" size="icon-sm" onClick={saveEdit} title="Save (Enter)">
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setEditingId(null)}
                                  title="Cancel (Esc)"
                                >
                                  <X className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => startEdit(saved)}
                                  title="Edit line"
                                >
                                  <Pencil className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleRemoveItem(saved.id)}
                                  title="Remove line"
                                >
                                  <Trash2 className="w-4 h-4 text-orange-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Product price updates that saving this bill will apply */}
          {priceUpdates.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                  <AlertTriangle className="w-4 h-4" /> Product prices will be updated on save (
                  {priceUpdates.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  The new MRP, Selling Price and Cost Price from this bill replace the current product
                  prices. (Only if this is the latest bill date for that product.)
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Selling Price</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceUpdates.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        {[u.mrp, u.selling, u.cost].map((c, i) => (
                          <TableCell key={i} className="text-right text-xs whitespace-nowrap">
                            {changed(c.old, c.new) ? (
                              <>
                                <span className="text-muted-foreground line-through">
                                  {c.old > 0 ? fmt(c.old) : "—"}
                                </span>{" "}
                                →{" "}
                                <span
                                  className={`font-semibold ${
                                    c.new > c.old ? "text-red-600" : "text-green-700"
                                  }`}
                                >
                                  {fmt(c.new)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">{fmt(c.new)} (same)</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN - Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-orange-200 shadow-md">
            <CardHeader className="bg-orange-50/30 pb-4">
              <CardTitle className="text-lg">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">
                    {suppliers.find((s) => s.id === supplierId)?.name || "None"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {new Date(purchaseDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="font-medium">{invoiceNumber || "-"}</span>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Amount:</span>
                    <span>LKR {fmt(totalGross)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>UDF Discount (line Disc %):</span>
                    <span>- {fmt(totalLineDiscount)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-medium border-t border-dashed pt-2">
                  <span>Subtotal:</span>
                  <span>LKR {fmt(subtotal)}</span>
                </div>
                <div className="space-y-2 bg-orange-50 p-3 rounded-md border border-orange-100">
                  <div className="text-xs font-semibold text-orange-900">
                    Invoice Discounts (%) — reduce cost
                  </div>
                  {[
                    { label: "Distributor Margin", value: dmPct, set: setDmPct, amount: dmAmount, hint: "→ Cost Price" },
                    { label: "Cash Discount", value: cashPct, set: setCashPct, amount: cashAmount, hint: "→ Actual Cost" },
                    { label: "RD Discount", value: rdPct, set: setRdPct, amount: rdAmount, hint: "→ Cost Price" },
                    { label: "Additional Disc.", value: addPct, set: setAddPct, amount: addAmount, hint: "→ Actual Cost" },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-2">
                      <div className="leading-tight">
                        <Label className="text-xs text-orange-800">{d.label}</Label>
                        <div className="text-[10px] text-muted-foreground">{d.hint}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 w-20 text-right">
                          {d.amount > 0 ? `- ${fmt(d.amount)}` : ""}
                        </span>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={d.value}
                            onChange={(e) =>
                              d.set(e.target.value === "" ? "" : parseFloat(e.target.value))
                            }
                            placeholder="0"
                            className="h-7 w-20 pr-6 text-right text-xs bg-white"
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {subtotal - finalTotal > 0 && (
                    <div className="flex justify-between text-xs text-red-600 font-medium border-t border-orange-200 pt-2">
                      <span>Total discounts:</span>
                      <span>- LKR {fmt(subtotal - finalTotal)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-orange-100 mt-2">
                  <span className="font-bold text-lg">Net Payable:</span>
                  <span className="text-2xl font-bold text-orange-600">
                    LKR{" "}
                    {fmt(Math.max(0, finalTotal))}
                  </span>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Invoice &quot;Total Amount&quot;</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceTotal}
                      onChange={(e) =>
                        setInvoiceTotal(e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                      placeholder="From invoice"
                      className="h-7 w-32 text-right text-xs"
                    />
                  </div>
                  {invoiceTotalNum > 0 &&
                    (totalMatches ? (
                      <div className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="w-4 h-4" /> Matches the invoice
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="w-4 h-4" /> Difference: LKR {fmt(totalDifference)}
                      </div>
                    ))}
                </div>
              </div>
              <Button
                onClick={handleSavePurchase}
                className="w-full bg-orange-600 hover:bg-orange-700 mt-4"
                size="lg"
                disabled={items.length === 0 || submitting}
              >
                {submitting ? (
                  "Processing..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Confirm Bill
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={handleCreateProduct}
        selectedProduct={null}
        isDeleteDialogOpen={false}
        setIsDeleteDialogOpen={() => {}}
        onDeleteConfirm={async () => {}}
        categories={categories}
      />
      <SupplierDialogs
        isAddDialogOpen={isAddSupplierDialogOpen}
        setIsAddDialogOpen={setIsAddSupplierDialogOpen}
        formData={supplierFormData}
        setFormData={setSupplierFormData}
        onSave={handleCreateSupplier}
        selectedSupplier={null}
        categoryOptions={supplierCategories}
        isDeleteDialogOpen={false}
        setIsDeleteDialogOpen={() => {}}
        onDeleteConfirm={() => {}}
      />
    </div>
  );
}
