"use client";

// Column explorer for the product tree:
// Category -> Sub Category -> Product Family -> Specification.
// Click an item to open it in the next column; add, rename and delete in place.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  FolderOpen,
  Layers,
  FileText,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
  category_id?: string | null;
  description?: string | null;
}

type Level = "category" | "sub" | "family" | "spec";

const API = "/api/settings/categories";

const byName = (a: Item, b: Item) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export function ProductHierarchyManager() {
  const [cats, setCats] = useState<Item[]>([]);
  const [families, setFamilies] = useState<Item[]>([]);
  const [specs, setSpecs] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [catId, setCatId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ item: Item; level: Level } | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, f, s] = await Promise.all(
        ["category", "family", "spec"].map((t) =>
          fetch(`${API}?type=${t}`).then((r) => (r.ok ? r.json() : [])),
        ),
      );
      setCats(Array.isArray(c) ? c : []);
      setFamilies(Array.isArray(f) ? f : []);
      setSpecs(Array.isArray(s) ? s : []);
    } catch {
      toast.error("Could not load product settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- Derived lists ---
  const mainCats = useMemo(() => cats.filter((c) => !c.parent_id).sort(byName), [cats]);
  const subCats = useMemo(
    () => (catId ? cats.filter((c) => c.parent_id === catId).sort(byName) : []),
    [cats, catId],
  );
  const selectedCat = mainCats.find((c) => c.id === catId) || null;
  const selectedSub = subCats.find((c) => c.id === subId) || null;

  // Families live on the sub category; a category without sub categories holds them itself
  const familyScope: Item | null = selectedSub || (selectedCat && subCats.length === 0 ? selectedCat : null);
  const scopeFamilies = useMemo(
    () =>
      familyScope
        ? families.filter((f) => !f.parent_id && f.category_id === familyScope.id).sort(byName)
        : [],
    [families, familyScope],
  );
  const selectedFamily = scopeFamilies.find((f) => f.id === familyId) || null;

  // Specs belong to the picked family, or to the whole sub category ("General")
  const specParent: Item | null = familyScope ? selectedFamily || familyScope : null;
  const scopeSpecs = useMemo(
    () => (specParent ? specs.filter((s) => s.parent_id === specParent.id).sort(byName) : []),
    [specs, specParent],
  );

  const count = {
    subs: (id: string) => cats.filter((c) => c.parent_id === id).length,
    families: (id: string) => families.filter((f) => f.category_id === id && !f.parent_id).length,
    specs: (id: string) => specs.filter((s) => s.parent_id === id).length,
  };

  // --- Mutations ---
  const create = async (body: Record<string, unknown>, label: string) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || `Failed to add ${label}`);
      return false;
    }
    toast.success(`${label} added`);
    await load();
    return true;
  };

  const rename = async (item: Item, name: string) => {
    const res = await fetch(`${API}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Failed to rename");
      return false;
    }
    toast.success("Renamed");
    await load();
    return true;
  };

  // Only empty items can be deleted, so nothing is left without a parent
  const blockReason = (item: Item, level: Level): string | null => {
    if (level === "category") {
      if (count.subs(item.id)) return "Delete its sub categories first.";
      if (count.families(item.id)) return "Delete its product families first.";
      if (count.specs(item.id)) return "Delete its specifications first.";
    }
    if (level === "sub") {
      if (count.families(item.id)) return "Delete its product families first.";
      if (count.specs(item.id)) return "Delete its specifications first.";
    }
    if (level === "family" && count.specs(item.id)) return "Delete its specifications first.";
    return null;
  };

  const askDelete = (item: Item, level: Level) => {
    const reason = blockReason(item, level);
    if (reason) {
      toast.error(`"${item.name}" is not empty. ${reason}`);
      return;
    }
    setDeleteTarget({ item, level });
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { item } = deleteTarget;
    const res = await fetch(`${API}/${item.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    if (item.id === catId) setCatId(null);
    if (item.id === subId) setSubId(null);
    if (item.id === familyId) setFamilyId(null);
    toast.success(`"${item.name}" deleted`);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Path of the current selection */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm rounded-lg border bg-muted/30 px-4 py-2.5">
        <span className="text-muted-foreground">Selected:</span>
        {!selectedCat ? (
          <span className="text-muted-foreground italic">Pick a category to start</span>
        ) : (
          <>
            <PathChip color="blue" onClick={() => { setSubId(null); setFamilyId(null); }}>
              {selectedCat.name}
            </PathChip>
            {selectedSub && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <PathChip color="violet" onClick={() => setFamilyId(null)}>
                  {selectedSub.name}
                </PathChip>
              </>
            )}
            {selectedFamily && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <PathChip color="green">{selectedFamily.name}</PathChip>
              </>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1. Categories */}
        <Column
          step={1}
          title="Categories"
          icon={Package}
          color="blue"
          items={mainCats}
          selectedId={catId}
          onSelect={(it) => {
            setCatId(it.id);
            setSubId(null);
            setFamilyId(null);
          }}
          badge={(it) => count.subs(it.id) || count.families(it.id) || null}
          badgeLabel={(it) => (count.subs(it.id) ? "sub categories" : "families")}
          drill
          addPlaceholder="New category name"
          onAdd={(name) => create({ name, type: "category" }, "Category")}
          onRename={rename}
          onDelete={(it) => askDelete(it, "category")}
          emptyText="No categories yet. Add your first one above."
        />

        {/* 2. Sub Categories */}
        <Column
          key={`sub-${catId ?? "none"}`}
          step={2}
          title="Sub Categories"
          icon={FolderOpen}
          color="violet"
          items={subCats}
          selectedId={subId}
          onSelect={(it) => {
            setSubId(it.id);
            setFamilyId(null);
          }}
          badge={(it) => count.families(it.id) || null}
          badgeLabel={() => "families"}
          drill
          disabledText={!selectedCat ? "Select a category to see its sub categories." : undefined}
          addPlaceholder={selectedCat ? `New sub category in ${selectedCat.name}` : ""}
          onAdd={(name) =>
            create({ name, type: "category", parent_id: catId }, "Sub category")
          }
          onRename={rename}
          onDelete={(it) => askDelete(it, "sub")}
          emptyText={
            selectedCat
              ? `${selectedCat.name} has no sub categories. You can add product families to it directly in the next column.`
              : ""
          }
        />

        {/* 3. Product Families */}
        <Column
          key={`fam-${familyScope?.id ?? "none"}`}
          step={3}
          title="Product Families"
          icon={Layers}
          color="green"
          items={scopeFamilies}
          selectedId={familyId}
          onSelect={(it) => setFamilyId(it.id)}
          badge={(it) => count.specs(it.id) || null}
          badgeLabel={() => "specs"}
          drill
          disabledText={
            !selectedCat
              ? "Select a category first."
              : !familyScope
                ? "Select a sub category to see its product families."
                : undefined
          }
          topItem={
            familyScope
              ? {
                  label: "General specs",
                  hint: `Apply to every family in ${familyScope.name}`,
                  selected: familyId === null,
                  count: count.specs(familyScope.id),
                  onClick: () => setFamilyId(null),
                }
              : undefined
          }
          addPlaceholder={familyScope ? `New family in ${familyScope.name}` : ""}
          onAdd={(name) =>
            create({ name, type: "family", category_id: familyScope?.id }, "Product family")
          }
          onRename={rename}
          onDelete={(it) => askDelete(it, "family")}
          emptyText="No product families yet. Add one above, e.g. House Wire, Flexible Cable."
        />

        {/* 4. Specifications */}
        <Column
          key={`spec-${specParent?.id ?? "none"}`}
          step={4}
          title="Specifications"
          icon={FileText}
          color="orange"
          subtitle={
            specParent
              ? selectedFamily
                ? `For ${selectedFamily.name}`
                : `General for ${specParent.name}`
              : undefined
          }
          items={scopeSpecs}
          disabledText={!specParent ? "Select a sub category or product family first." : undefined}
          addPlaceholder={specParent ? "New spec, e.g. 100m, 1.5mm" : ""}
          onAdd={(name) =>
            create(
              {
                name,
                type: "spec",
                parent_id: specParent?.id,
                category_id: familyScope?.id,
              },
              "Specification",
            )
          }
          onRename={rename}
          onDelete={(it) => askDelete(it, "spec")}
          emptyText="No specifications yet. Add sizes, lengths or ratings above."
        />
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.item.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              It will no longer show in the product form dropdowns. Products already
              saved with this name keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

const COLORS = {
  blue: {
    head: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
    icon: "text-blue-600",
    sel: "bg-blue-600 text-white",
    selBadge: "bg-white/20 text-white",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  violet: {
    head: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400",
    icon: "text-violet-600",
    sel: "bg-violet-600 text-white",
    selBadge: "bg-white/20 text-white",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  green: {
    head: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
    icon: "text-green-600",
    sel: "bg-green-600 text-white",
    selBadge: "bg-white/20 text-white",
    chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  orange: {
    head: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400",
    icon: "text-orange-600",
    sel: "bg-orange-600 text-white",
    selBadge: "bg-white/20 text-white",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
} as const;

type ColorKey = keyof typeof COLORS;

function PathChip({
  color,
  onClick,
  children,
}: {
  color: ColorKey;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded-md font-medium text-xs",
        COLORS[color].chip,
        !onClick && "cursor-default",
      )}
    >
      {children}
    </button>
  );
}

interface ColumnProps {
  step: number;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  color: ColorKey;
  items: Item[];
  selectedId?: string | null;
  onSelect?: (it: Item) => void;
  badge?: (it: Item) => number | null;
  badgeLabel?: (it: Item) => string;
  drill?: boolean;
  disabledText?: string;
  topItem?: {
    label: string;
    hint: string;
    selected: boolean;
    count: number;
    onClick: () => void;
  };
  addPlaceholder: string;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (it: Item, name: string) => Promise<boolean>;
  onDelete: (it: Item) => void;
  emptyText: string;
}

function Column(props: ColumnProps) {
  const {
    step,
    title,
    subtitle,
    icon: Icon,
    color,
    items,
    selectedId,
    onSelect,
    badge,
    badgeLabel,
    drill,
    disabledText,
    topItem,
    addPlaceholder,
    onAdd,
    onRename,
    onDelete,
    emptyText,
  } = props;
  const c = COLORS[color];

  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const visible = query.trim()
    ? items.filter((it) => it.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  const submitAdd = async () => {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    const ok = await onAdd(name);
    setAdding(false);
    if (ok) setNewName("");
  };

  const submitEdit = async (it: Item) => {
    const name = editName.trim();
    if (!name || name === it.name) {
      setEditId(null);
      return;
    }
    setSavingEdit(true);
    const ok = await onRename(it, name);
    setSavingEdit(false);
    if (ok) setEditId(null);
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden min-h-[320px] xl:h-[620px]">
      {/* Header */}
      <div className={cn("px-4 py-3 border-b", c.head)}>
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-background flex items-center justify-center text-xs font-bold shadow-sm">
            {step}
          </span>
          <Icon className={cn("h-4 w-4", c.icon)} />
          <h3 className="font-semibold text-sm flex-1">{title}</h3>
          {!disabledText && (
            <span className="text-xs font-medium opacity-70">{items.length}</span>
          )}
        </div>
        {subtitle && !disabledText && (
          <p className="text-xs mt-1 opacity-80 truncate">{subtitle}</p>
        )}
      </div>

      {disabledText ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 text-muted-foreground">
          <Icon className="h-8 w-8 mb-3 opacity-30" />
          <p className="text-sm">{disabledText}</p>
        </div>
      ) : (
        <>
          {/* Add */}
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                }}
                placeholder={addPlaceholder}
                className="h-9 text-sm"
                disabled={adding}
              />
              <Button
                size="sm"
                className="h-9 px-3 shrink-0"
                onClick={submitAdd}
                disabled={!newName.trim() || adding}
                title="Add"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            {items.length > 6 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${title.toLowerCase()}`}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-[420px] xl:max-h-none">
            {topItem && !query && (
              <button
                type="button"
                onClick={topItem.onClick}
                className={cn(
                  "w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 mb-1 border border-dashed transition-colors",
                  topItem.selected ? cn(c.sel, "border-transparent") : "hover:bg-muted/60",
                )}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{topItem.label}</span>
                  <span
                    className={cn(
                      "block text-[11px] truncate",
                      topItem.selected ? "text-white/80" : "text-muted-foreground",
                    )}
                  >
                    {topItem.hint}
                  </span>
                </span>
                {topItem.count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] rounded-full px-1.5",
                      topItem.selected ? c.selBadge : "bg-muted text-muted-foreground",
                    )}
                  >
                    {topItem.count}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            )}

            {visible.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center px-4 py-8">
                {query ? `Nothing matches "${query}".` : emptyText}
              </p>
            ) : (
              visible.map((it) => {
                const selected = it.id === selectedId;
                const n = badge?.(it) ?? null;

                if (editId === it.id) {
                  return (
                    <div key={it.id} className="flex items-center gap-1 px-1 py-1">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEdit(it);
                          if (e.key === "Escape") setEditId(null);
                        }}
                        className="h-8 text-sm"
                        disabled={savingEdit}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-green-600"
                        onClick={() => submitEdit(it)}
                        disabled={savingEdit}
                        title="Save"
                      >
                        {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditId(null)}
                        disabled={savingEdit}
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                }

                return (
                  <div
                    key={it.id}
                    role={onSelect ? "button" : undefined}
                    tabIndex={onSelect ? 0 : undefined}
                    onClick={() => onSelect?.(it)}
                    onKeyDown={(e) => {
                      if (onSelect && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onSelect(it);
                      }
                    }}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                      onSelect && "cursor-pointer",
                      selected ? c.sel : "hover:bg-muted/60",
                    )}
                  >
                    <span className="flex-1 min-w-0 text-sm font-medium truncate" title={it.name}>
                      {it.name}
                    </span>

                    <span className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditId(it.id);
                          setEditName(it.name);
                        }}
                        className={cn(
                          "h-6 w-6 rounded flex items-center justify-center",
                          selected ? "hover:bg-white/20" : "hover:bg-background text-muted-foreground hover:text-primary",
                        )}
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(it);
                        }}
                        className={cn(
                          "h-6 w-6 rounded flex items-center justify-center",
                          selected ? "hover:bg-white/20" : "hover:bg-background text-muted-foreground hover:text-destructive",
                        )}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>

                    {n !== null && (
                      <span
                        className={cn(
                          "text-[11px] rounded-full px-1.5 min-w-[20px] text-center",
                          selected ? c.selBadge : "bg-muted text-muted-foreground",
                        )}
                        title={`${n} ${badgeLabel?.(it) ?? ""}`}
                      >
                        {n}
                      </span>
                    )}
                    {drill && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
