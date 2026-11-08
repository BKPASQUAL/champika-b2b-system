"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type TaxonomyOption = { id: string; name: string; hint?: string | null };

/**
 * Searchable dropdown for a website classification field (category, family,
 * brand…). Always selectable: type to search, or add a new value from the list.
 * - `hint` shows the parent (e.g. "Wiring Accessories" for a sub category).
 * - `suggestion`: value from the linked main item → "Use …" / "+ Add …".
 */
export function TaxonomyField({
  label,
  value,
  options,
  onChange,
  onCreate,
  suggestion,
  placeholder = "Select…",
  createHint,
}: {
  label: string;
  value: string | null;
  options: TaxonomyOption[];
  onChange: (id: string | null) => void;
  onCreate: (name: string) => Promise<TaxonomyOption>;
  suggestion?: string | null;
  placeholder?: string;
  /** Shown under "+ Add" in the list, e.g. "in Wiring Accessories". */
  createHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = options.find((o) => o.id === value);
  const sug = suggestion?.trim() || "";
  const sugMatch = sug ? options.find((o) => o.name.toLowerCase() === sug.toLowerCase()) : undefined;
  const typed = query.trim();
  const exact = typed ? options.find((o) => o.name.toLowerCase() === typed.toLowerCase()) : undefined;

  const create = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const existing = options.find((o) => o.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      onChange(existing.id);
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const created = await onCreate(clean);
      onChange(created.id);
      toast.success(`${label} “${created.name}” added`);
      setOpen(false);
      setQuery("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9 px-3" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : selected ? (
              <span className="truncate text-left">
                {selected.hint && <span className="text-muted-foreground">{selected.hint} › </span>}
                {selected.name}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <span className="flex items-center gap-1 shrink-0 ml-2">
              {selected && (
                <X
                  className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onChange(null); }}
                />
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-(--radix-popover-trigger-width) min-w-[260px]" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">No match.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.name} ${o.hint ?? ""} ${o.id}`}
                    onSelect={() => { onChange(o.id); setOpen(false); }}
                  >
                    <Check className={cn("h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">
                      {o.name}
                      {o.hint && <span className="text-xs text-muted-foreground"> · {o.hint}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {typed && !exact && (
              <button
                type="button"
                onClick={() => create(typed)}
                className="w-full border-t px-3 py-2 text-left text-sm text-teal-700 hover:bg-teal-50 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add “{typed}”
                {createHint && <span className="text-xs text-muted-foreground ml-1">{createHint}</span>}
              </button>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {sug && value !== sugMatch?.id && (
        <button
          type="button"
          disabled={busy}
          onClick={() => (sugMatch ? onChange(sugMatch.id) : create(sug))}
          className="text-[11px] text-teal-700 hover:underline flex items-center gap-1"
          title="From the linked main item"
        >
          <Sparkles className="h-3 w-3" />
          {sugMatch ? `Use “${sugMatch.name}”` : `+ Add “${sug}”`} <span className="text-muted-foreground">(from main item)</span>
        </button>
      )}
    </div>
  );
}
