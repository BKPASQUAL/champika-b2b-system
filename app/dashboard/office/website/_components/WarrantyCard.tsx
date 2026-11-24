"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { webApi } from "./api";
import type { WebBrand } from "./types";

export type WarrantyPreset = { id: string; name: string; period: string; brandId: string | null; terms: string };

export const QUICK_PERIODS = ["Lifetime", "6 months", "1 year", "2 years", "3 years", "5 years", "10 years"];

/** "Orange › Akoya" style label for a brand or sub brand id. */
export function brandLabel(brands: WebBrand[], id: string | null): string | null {
  if (!id) return null;
  const b = brands.find((x) => x.id === id);
  if (!b) return null;
  const parent = b.parentId ? brands.find((x) => x.id === b.parentId) : null;
  return parent ? `${parent.name} › ${b.name}` : b.name;
}

const NONE = "none";
const CUSTOM = "custom";

/**
 * Warranty picker for a website product. Warranty types (period + terms, per
 * brand / model) are managed on the Warranties page; picking one copies its
 * values onto the product. "Custom" lets you type a one-off warranty.
 */
export function WarrantyCard({
  period,
  terms,
  brandId,
  subBrandId,
  brands,
  onChange,
}: {
  period: string;
  terms: string;
  brandId: string | null;
  subBrandId: string | null;
  brands: WebBrand[];
  onChange: (patch: { warrantyPeriod?: string; warrantyTerms?: string }) => void;
}) {
  const [presets, setPresets] = useState<WarrantyPreset[]>([]);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    webApi<{ presets: WarrantyPreset[] }>("/api/website/warranties")
      .then((r) => setPresets(r.presets || []))
      .catch(() => {});
  }, []);

  const same = (p: WarrantyPreset) =>
    p.period.trim().toLowerCase() === period.trim().toLowerCase() && (p.terms || "").trim() === terms.trim();
  const current = period.trim() ? presets.find(same) : undefined;
  const value = !period.trim() && !customMode ? NONE : current && !customMode ? current.id : CUSTOM;

  // This product's brand / model first, then general ones, then the rest.
  const groups = useMemo(() => {
    const label = (p: WarrantyPreset) => p.name || p.period;
    const sort = (a: WarrantyPreset, b: WarrantyPreset) => label(a).localeCompare(label(b));
    const mine = presets.filter((p) => p.brandId && (p.brandId === subBrandId || p.brandId === brandId)).sort(sort);
    const general = presets.filter((p) => !p.brandId).sort(sort);
    const other = presets.filter((p) => !mine.includes(p) && !general.includes(p)).sort(sort);
    const myBrand = brandLabel(brands, subBrandId) || brandLabel(brands, brandId);
    return [
      { title: myBrand ? `For ${myBrand}` : "This brand", items: mine },
      { title: "Any brand", items: general },
      { title: "Other brands", items: other },
    ].filter((g) => g.items.length > 0);
  }, [presets, brandId, subBrandId, brands]);

  const pick = (v: string) => {
    if (v === NONE) {
      setCustomMode(false);
      onChange({ warrantyPeriod: "", warrantyTerms: "" });
    } else if (v === CUSTOM) {
      setCustomMode(true);
    } else {
      const p = presets.find((x) => x.id === v);
      if (!p) return;
      setCustomMode(false);
      onChange({ warrantyPeriod: p.period, warrantyTerms: p.terms || "" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600" /> Warranty
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Shown on the shop product page with its terms.</p>
        </div>
        <Link
          href="/dashboard/office/website/warranties"
          target="_blank"
          className="text-[11px] text-teal-700 hover:underline flex items-center gap-1 shrink-0"
        >
          Manage warranties <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1 max-w-md">
          <Label>Warranty</Label>
          <Select value={value} onValueChange={pick}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No warranty</SelectItem>
              {groups.map((g) => (
                <SelectGroup key={g.title}>
                  <SelectLabel className="text-[11px] text-muted-foreground">{g.title}</SelectLabel>
                  {g.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name ? `${p.name} · ${p.period}` : p.period}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              <SelectItem value={CUSTOM}>Custom (type for this item only)…</SelectItem>
            </SelectContent>
          </Select>
          {presets.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              No warranty types yet — add Lifetime / 5 years / 2 years etc. on the Warranties page.
            </p>
          )}
        </div>

        {value === CUSTOM && (
          <>
            <div className="space-y-1 max-w-sm">
              <Label>Warranty period</Label>
              <Input value={period} maxLength={60} placeholder="e.g. 1 year" onChange={(e) => onChange({ warrantyPeriod: e.target.value })} />
              <div className="flex flex-wrap gap-1 pt-1">
                {QUICK_PERIODS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onChange({ warrantyPeriod: q })}
                    className={`text-[11px] rounded px-2 py-0.5 border ${period === q ? "border-teal-500 bg-teal-50 text-teal-800" : "hover:bg-muted"}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Warranty terms (optional)</Label>
              <Textarea
                rows={4}
                maxLength={2000}
                value={terms}
                placeholder={"- Covers manufacturing defects only\n- Keep the bill / invoice for claims"}
                onChange={(e) => onChange({ warrantyTerms: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">Lines starting with “-” show as bullet points on the shop.</p>
            </div>
          </>
        )}

        {current && value !== CUSTOM && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p className="font-medium text-sm">{period} warranty</p>
            {terms ? (
              <p className="text-muted-foreground whitespace-pre-line">{terms}</p>
            ) : (
              <p className="text-muted-foreground italic">No terms added for this warranty.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
