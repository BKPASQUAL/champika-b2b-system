"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Percent, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveWebPrice, type WebPriceRule } from "@/lib/web-pricing-core";
import { webApi, rs } from "../_components/api";

type Rule = {
  id?: string;
  scope: "brand" | "category" | "web_category" | "web_brand";
  scopeValue: string;
  tier: "normal" | "trade";
  method: "mrp_discount_pct" | "cost_markup_pct";
  value: number;
  priority: number;
  isActive: boolean;
};
type Named = { id: string; name: string };
type Options = { brands: string[]; categories: string[]; webCategories: Named[]; webBrands: Named[] };

const emptyRule: Rule = { scope: "web_brand", scopeValue: "", tier: "normal", method: "mrp_discount_pct", value: 10, priority: 0, isActive: true };

const scopeLabel = { brand: "B2B brand", category: "Main category", web_category: "Website category", web_brand: "Website brand" };

export default function PriceRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [options, setOptions] = useState<Options>({ brands: [], categories: [], webCategories: [], webBrands: [] });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([
      webApi<{ rules: Rule[]; options: Options }>("/api/website/price-rules"),
      webApi<any[]>("/api/website/products"),
    ])
      .then(([r, p]) => {
        setRules(r.rules);
        setOptions(r.options);
        setProducts(p);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const scopeName = (r: Rule) =>
    r.scope === "web_category"
      ? options.webCategories.find((c) => c.id === r.scopeValue)?.name ?? "(deleted)"
      : r.scope === "web_brand"
        ? options.webBrands.find((c) => c.id === r.scopeValue)?.name ?? "(deleted)"
        : r.scopeValue;

  // Live preview: which website items the rule in the form affects, before → after.
  const preview = useMemo(() => {
    if (!form || !form.scopeValue) return [];
    const toCore = (r: Rule): WebPriceRule => ({
      id: r.id || "draft",
      scope: r.scope,
      scope_value: r.scopeValue,
      tier: r.tier,
      method: r.method,
      value: r.value,
      priority: r.priority,
      is_active: r.isActive,
    });
    const current = rules.filter((r) => r.isActive).map(toCore);
    const withDraft = [...current.filter((r) => r.id !== form.id), toCore(form)];
    const norm = (s: string | null) => (s || "").toLowerCase().trim();
    // One row per variant, since brand/category come from each variant's main product.
    return products
      .flatMap((p) => p.variants.map((v: any) => ({ p, v })))
      .filter(({ p, v }) =>
        form.scope === "web_category"
          ? p.webCategoryId === form.scopeValue
          : form.scope === "web_brand"
            ? p.webBrandId === form.scopeValue
          : form.scope === "brand"
            ? norm(v.main.brand) === norm(form.scopeValue)
            : norm(v.main.category) === norm(form.scopeValue),
      )
      .map(({ p, v }) => {
        const web = { mrp: v.mrp, web_price: v.webPrice, trade_price: v.tradePrice, web_category_id: p.webCategoryId, web_brand_id: p.webBrandId, qty_multiplier: v.qtyMultiplier };
        const main = { mrp: v.main.mrp, cost_price: v.main.costPrice, brand: v.main.brand, category: v.main.category };
        const before = resolveWebPrice(web, main, form.tier, current);
        const after = resolveWebPrice(web, main, form.tier, withDraft);
        const name = p.options.length ? `${p.name} — ${v.label}` : p.name;
        return { id: v.id, name, cost: v.unitCost, before, after };
      });
  }, [form, rules, products]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await webApi("/api/website/price-rules", { method: "POST", json: form });
      toast.success("Rule saved — shop prices updated");
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Rule) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await webApi(`/api/website/price-rules?id=${r.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const valueOptions =
    form?.scope === "brand" ? options.brands : form?.scope === "category" ? options.categories : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Price Rules</h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Set website prices by brand or category. Order used: item’s own price → website category rule → main category
            rule → brand rule → MRP. Prices never go below cost. Trade customers fall back to normal rules when no trade rule exists.
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setForm({ ...emptyRule })}>
          <Plus className="h-4 w-4 mr-1" /> New Rule
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-3">Applies to</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Price</th>
              <th className="text-right p-3">Priority</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && <tr><td colSpan={5} className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></td></tr>}
            {!loading && rules.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  <Percent className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No rules — every item sells at MRP. Example: “Orange · Normal · 10% off MRP”.
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                <td className="p-3">
                  <span className="text-xs text-muted-foreground">{scopeLabel[r.scope]}: </span>
                  <span className="font-medium">{scopeName(r)}</span>
                </td>
                <td className="p-3">
                  <Badge className={r.tier === "trade" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-teal-100 text-teal-800 hover:bg-teal-100"}>
                    {r.tier === "trade" ? "Trade" : "Normal"}
                  </Badge>
                </td>
                <td className="p-3">
                  {r.method === "mrp_discount_pct" ? `${r.value}% off MRP` : `Cost + ${r.value}%`}
                  {!r.isActive && <Badge variant="secondary" className="ml-2">Off</Badge>}
                </td>
                <td className="p-3 text-right">{r.priority}</td>
                <td className="p-3 whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" onClick={() => setForm(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Price Rule" : "New Price Rule"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Rule type</Label>
                  <Select value={form.scope} onValueChange={(v: any) => setForm({ ...form, scope: v, scopeValue: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web_brand">By website brand (recommended)</SelectItem>
                      <SelectItem value="web_category">By website category</SelectItem>
                      <SelectItem value="category">By main (B2B) category</SelectItem>
                      <SelectItem value="brand">By main (B2B) brand field</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{scopeLabel[form.scope]}</Label>
                  <Select value={form.scopeValue || undefined} onValueChange={(v) => setForm({ ...form, scopeValue: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent>
                      {form.scope === "web_category"
                        ? options.webCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                        : form.scope === "web_brand"
                          ? options.webBrands.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                          : valueOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Customer type</Label>
                  <Select value={form.tier} onValueChange={(v: any) => setForm({ ...form, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal customers</SelectItem>
                      <SelectItem value="trade">Trade (electricians / contractors)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Price method</Label>
                  <Select value={form.method} onValueChange={(v: any) => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mrp_discount_pct">% discount off MRP</SelectItem>
                      <SelectItem value="cost_markup_pct">Cost + % markup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{form.method === "mrp_discount_pct" ? "Discount %" : "Markup %"}</Label>
                  <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label title="When two rules of the same type match, the higher priority wins">Priority</Label>
                  <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Active
              </label>

              {form.scopeValue && (
                <div className="border rounded-md">
                  <p className="text-xs font-medium p-2 bg-muted/50">Preview — {preview.length} website items affected</p>
                  <div className="max-h-60 overflow-y-auto divide-y text-xs">
                    {preview.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 p-2">
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-muted-foreground">MRP {rs(p.after.mrp)}</span>
                        <span className="line-through text-muted-foreground">{rs(p.before.price)}</span>
                        <span className="font-semibold">{rs(p.after.price)}</span>
                        <span className={p.after.price - p.cost < 0 ? "text-red-600" : "text-green-700"}>
                          margin {rs(p.after.price - p.cost)}
                        </span>
                        {p.after.clampedToCost && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                      </div>
                    ))}
                    {preview.length === 0 && <p className="p-2 text-muted-foreground">No website items match yet.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !form?.scopeValue}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
