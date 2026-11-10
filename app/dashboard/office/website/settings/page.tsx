"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { webApi } from "../_components/api";
import { Checkbox } from "@/components/ui/checkbox";

type Settings = {
  delivery: { flat_fee: number; free_over: number; areas: string };
  bank: { bank: string; branch: string; account_name: string; account_no: string };
  store: { name: string; phone: string; whatsapp: string; address: string; email: string; hours: string; map_url: string };
  catalog: { allowed_categories: string[] };
};

const defaults: Settings = {
  delivery: { flat_fee: 0, free_over: 0, areas: "" },
  bank: { bank: "", branch: "", account_name: "", account_no: "" },
  store: { name: "BK Wiring", phone: "", whatsapp: "", address: "", email: "", hours: "", map_url: "" },
  catalog: { allowed_categories: ["Wiring Accessories"] },
};

export default function ShopSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [mainCategories, setMainCategories] = useState<string[]>([]);

  useEffect(() => {
    webApi<Partial<Settings>>("/api/website/settings")
      .then((d: any) => {
        setMainCategories(d._mainCategories || []);
        setS({
          delivery: { ...defaults.delivery, ...d.delivery },
          bank: { ...defaults.bank, ...d.bank },
          store: { ...defaults.store, ...d.store },
          catalog: { allowed_categories: d.catalog?.allowed_categories ?? defaults.catalog.allowed_categories },
        });
      })
      .catch((e) => toast.error(e.message));
  }, []);

  if (!s) return <Loader2 className="h-6 w-6 animate-spin text-teal-600" />;

  const set = <K extends keyof Settings>(group: K, key: keyof Settings[K], value: any) =>
    setS({ ...s, [group]: { ...s[group], [key]: value } });

  const field = <K extends keyof Settings>(group: K, key: keyof Settings[K], label: string, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={String(s[group][key] ?? "")} onChange={(e) => set(group, key, e.target.value)} />
    </div>
  );

  const save = async () => {
    setSaving(true);
    try {
      await webApi("/api/website/settings", { method: "POST", json: s });
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Shop Settings</h2>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
      </div>

      <Card className="border-teal-300">
        <CardHeader>
          <CardTitle className="text-base">What the website sells</CardTitle>
          <p className="text-xs text-muted-foreground">
            Only main (B2B) items in the ticked categories can be searched, linked or imported. Phase 1: Wiring Accessories
            only. Untick everything to allow all categories.
          </p>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2">
          {[...new Set([...mainCategories, ...s.catalog.allowed_categories])].map((c) => {
            const on = s.catalog.allowed_categories.includes(c);
            return (
              <label key={c} className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 ${on ? "border-teal-400 bg-teal-50" : ""}`}>
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) =>
                    setS({
                      ...s,
                      catalog: {
                        allowed_categories: v
                          ? [...s.catalog.allowed_categories, c]
                          : s.catalog.allowed_categories.filter((x) => x !== c),
                      },
                    })
                  }
                />
                {c}
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store details (shown on the shop)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Customers trust a shop they can call and visit. Fill these in: they show on the home page, footer and the green WhatsApp button.
          </p>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          {field("store", "name", "Store name")}
          {field("store", "phone", "Phone")}
          {field("store", "whatsapp", "WhatsApp number")}
          {field("store", "email", "Email")}
          <div className="sm:col-span-2">{field("store", "address", "Address")}</div>
          {field("store", "hours", "Opening hours (e.g. Mon–Sat 8.00am – 7.00pm)")}
          {field("store", "map_url", "Google Maps link (optional)")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Delivery</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          {field("delivery", "flat_fee", "Delivery fee (Rs)", "number")}
          {field("delivery", "free_over", "Free delivery for orders over (Rs, 0 = never)", "number")}
          <div className="sm:col-span-2">{field("delivery", "areas", "Areas we deliver to (e.g. Galle, Matara, Hikkaduwa)")}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bank transfer details (shown at checkout)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          {field("bank", "bank", "Bank")}
          {field("bank", "branch", "Branch")}
          {field("bank", "account_name", "Account name")}
          {field("bank", "account_no", "Account number")}
        </CardContent>
      </Card>
    </div>
  );
}
