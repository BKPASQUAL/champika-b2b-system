"use client";

import { useEffect, useState } from "react";
import { Bookmark, Loader2, Pencil, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { webApi } from "./api";

type Preset = { id: string; period: string; terms: string };

const QUICK_PERIODS = ["3 months", "6 months", "1 year", "2 years", "3 years", "5 years"];

/**
 * Optional warranty for a website product. Off = nothing shown on the shop.
 * Presets are a reusable list (period + terms) — picking one copies its values here.
 */
export function WarrantyCard({
  period,
  terms,
  onChange,
}: {
  period: string;
  terms: string;
  onChange: (patch: { warrantyPeriod?: string; warrantyTerms?: string }) => void;
}) {
  const [on, setOn] = useState(!!period);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOn((cur) => cur || !!period), [period]);

  useEffect(() => {
    webApi<{ presets: Preset[] }>("/api/website/warranties")
      .then((r) => setPresets(r.presets || []))
      .catch(() => {});
  }, []);

  const savePresets = async (next: Preset[], msg: string) => {
    setBusy(true);
    try {
      const r = await webApi<{ presets: Preset[] }>("/api/website/warranties", { method: "POST", json: { presets: next } });
      setPresets(r.presets);
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const same = (p: Preset) => p.period.trim().toLowerCase() === period.trim().toLowerCase() && p.terms.trim() === terms.trim();
  const current = presets.find(same);

  const addPreset = () => {
    if (!period.trim()) return toast.error("Enter the warranty period first");
    if (current) return toast.info("This warranty is already saved");
    savePresets([...presets, { id: crypto.randomUUID(), period: period.trim(), terms: terms.trim() }], "Warranty saved for reuse");
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600" /> Warranty
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Only for items that have one. Shown on the shop product page.</p>
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0">
          <Switch
            checked={on}
            onCheckedChange={(v) => {
              setOn(v);
              if (!v) onChange({ warrantyPeriod: "", warrantyTerms: "" });
            }}
          />
          {on ? "Has warranty" : "No warranty"}
        </label>
      </CardHeader>

      {on && (
        <CardContent className="space-y-4">
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Saved warranties</Label>
                <button type="button" className="text-[11px] text-teal-700 hover:underline flex items-center gap-1" onClick={() => setManaging((m) => !m)}>
                  <Pencil className="h-3 w-3" /> {managing ? "Done" : "Manage"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <span
                    key={p.id}
                    className={`inline-flex items-center rounded-md border text-xs ${same(p) ? "border-teal-500 bg-teal-50 text-teal-800" : "bg-white hover:border-teal-300"}`}
                  >
                    <button
                      type="button"
                      className="px-2 py-1 text-left"
                      title={p.terms || "No terms"}
                      onClick={() => onChange({ warrantyPeriod: p.period, warrantyTerms: p.terms })}
                    >
                      <b className="font-medium">{p.period}</b>
                      {p.terms && <span className="text-muted-foreground"> · {p.terms.slice(0, 32)}{p.terms.length > 32 ? "…" : ""}</span>}
                    </button>
                    {managing && (
                      <button
                        type="button"
                        disabled={busy}
                        className="px-1.5 py-1 border-l text-red-600 hover:bg-red-50"
                        title="Delete this saved warranty (products already using it keep their warranty)"
                        onClick={() => savePresets(presets.filter((x) => x.id !== p.id), "Saved warranty removed")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

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
              placeholder={"e.g.\n- Manufacturer warranty against factory defects\n- Keep the bill / invoice for claims\n- Not covered: burns, wrong wiring, physical damage"}
              onChange={(e) => onChange({ warrantyTerms: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">Lines starting with “-” show as bullet points on the shop.</p>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" disabled={busy || !period.trim() || !!current} onClick={addPreset}>
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bookmark className="h-3 w-3 mr-1" />}
              {current ? "Saved for reuse" : "Save for reuse"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
