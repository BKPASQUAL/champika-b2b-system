"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { webApi, rs } from "./api";

export type MainProduct = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  subCategory: string | null;
  productFamily?: string | null;
  subBrand?: string | null;
  modelType?: string | null;
  subModel?: string | null;
  sizeSpec?: string | null;
  supplierName: string | null;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  images: string[];
  unit: string | null;
  mainStock: number;
  alreadyOnWebsite: boolean;
};

/** Debounced search over main B2B products (staff only — shows cost & stock). */
export function useMainProductSearch(search: string, limit = 30, subCategory = "") {
  const [results, setResults] = useState<MainProduct[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const sub = subCategory ? `&subCategory=${encodeURIComponent(subCategory)}` : "";
      webApi<MainProduct[]>(`/api/website/main-products?limit=${limit}&search=${encodeURIComponent(search)}${sub}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, limit, subCategory]);
  return { results, loading };
}

/** Single-select picker used in the product form. */
export function MainProductPicker({
  selected,
  onSelect,
}: {
  selected: MainProduct | null;
  onSelect: (p: MainProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const { results, loading } = useMainProductSearch(search, 15);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="rounded-md border border-teal-300 bg-teal-50 p-2 text-sm">
          <p className="font-medium">{selected.name}</p>
          <p className="text-xs text-muted-foreground">
            {selected.sku} · {selected.brand || "No brand"} · MRP {rs(selected.mrp)} · Cost {rs(selected.costPrice)} · Main stock{" "}
            <b>{selected.mainStock}</b>
          </p>
        </div>
      )}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={selected ? "Change linked product…" : "Search main product by name / SKU / brand"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search && (
        <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
          {loading && <div className="p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!loading && results.length === 0 && <p className="p-3 text-sm text-muted-foreground">No products found</p>}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left p-2 hover:bg-muted text-sm"
              onClick={() => {
                onSelect(p);
                setSearch("");
              }}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground block">
                {p.sku} · {p.brand || "-"} · MRP {rs(p.mrp)} · Stock {p.mainStock}
                {p.alreadyOnWebsite && " · already on website"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sub categories available within the allowed B2B categories, for filter dropdowns. */
export function useMainFacets(enabled = true) {
  const [facets, setFacets] = useState<{ allowed: string[]; subCategories: string[] }>({ allowed: [], subCategories: [] });
  useEffect(() => {
    if (!enabled) return;
    webApi<{ allowed: string[]; subCategories: string[] }>("/api/website/main-products?facets=1")
      .then(setFacets)
      .catch(() => {});
  }, [enabled]);
  return facets;
}
