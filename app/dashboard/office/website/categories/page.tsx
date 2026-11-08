"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, ChevronRight, FolderOpen, ImageIcon, Layers, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { webApi } from "../_components/api";
import { ImageUploader } from "../_components/ImageUploader";

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type Family = {
  id: string;
  name: string;
  webCategoryId: string | null;
  imageUrl: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

/** One row in any column. */
type Item = { id: string; name: string; imageUrl: string | null; isActive: boolean; productCount: number; childCount?: number };

type EditTarget = { kind: "category"; data: Category } | { kind: "family"; data: Family };

const COLORS = {
  teal: { head: "bg-teal-50 text-teal-800", icon: "text-teal-600", sel: "bg-teal-600 text-white hover:bg-teal-600", chip: "bg-teal-100 text-teal-800" },
  violet: { head: "bg-violet-50 text-violet-800", icon: "text-violet-600", sel: "bg-violet-600 text-white hover:bg-violet-600", chip: "bg-violet-100 text-violet-800" },
  green: { head: "bg-green-50 text-green-800", icon: "text-green-600", sel: "bg-green-600 text-white hover:bg-green-600", chip: "bg-green-100 text-green-800" },
} as const;
type ColorKey = keyof typeof COLORS;

export default function WebsiteCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainId, setMainId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [c, f] = await Promise.all([webApi<Category[]>("/api/website/categories"), webApi<Family[]>("/api/website/families")]);
      setCategories(c);
      setFamilies(f);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mains = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const subs = useMemo(() => categories.filter((c) => c.parentId === mainId), [categories, mainId]);
  const fams = useMemo(() => families.filter((f) => f.webCategoryId === subId), [families, subId]);
  const mainSel = categories.find((c) => c.id === mainId);
  const subSel = categories.find((c) => c.id === subId);

  // Open the first main category so the page is never empty.
  useEffect(() => {
    if (!mainId && mains.length) setMainId(mains[0].id);
  }, [mains, mainId]);

  const toItem = (c: Category): Item => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    isActive: c.isActive,
    productCount: c.productCount,
    childCount: categories.filter((x) => x.parentId === c.id).length,
  });
  const famItem = (f: Family): Item => ({ id: f.id, name: f.name, imageUrl: f.imageUrl, isActive: f.isActive, productCount: f.productCount });

  const addCategory = async (name: string, parentId: string | null) => {
    try {
      const c = await webApi<any>("/api/website/categories", { method: "POST", json: { name, parentId } });
      await load();
      if (parentId) setSubId(c.id);
      else {
        setMainId(c.id);
        setSubId(null);
      }
      toast.success(`“${name}” added`);
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    }
  };

  const addFamily = async (name: string) => {
    try {
      await webApi("/api/website/families", { method: "POST", json: { name, webCategoryId: subId } });
      await load();
      toast.success(`“${name}” added`);
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    }
  };

  const removeCategory = async (c: Category) => {
    const kids = categories.filter((x) => x.parentId === c.id).length;
    const msg = c.parentId
      ? `Delete sub category "${c.name}"? Its products keep existing, just without this sub category.`
      : `Delete main category "${c.name}"? Its ${kids} sub categories become main categories. Products keep existing.`;
    if (!confirm(msg)) return;
    try {
      await webApi(`/api/website/categories?id=${c.id}`, { method: "DELETE" });
      if (c.id === mainId) {
        setMainId(null);
        setSubId(null);
      }
      if (c.id === subId) setSubId(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeFamily = async (f: Family) => {
    if (!confirm(`Delete family "${f.name}"? Its products keep existing, just without this family.`)) return;
    try {
      await webApi(`/api/website/families?id=${f.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      if (edit.kind === "category") {
        const c = edit.data;
        await webApi("/api/website/categories", {
          method: "POST",
          json: { id: c.id, name: c.name, parentId: c.parentId, imageUrl: c.imageUrl, description: c.description, sortOrder: c.sortOrder, isActive: c.isActive },
        });
      } else {
        const f = edit.data;
        await webApi("/api/website/families", {
          method: "POST",
          json: { id: f.id, name: f.name, webCategoryId: f.webCategoryId, imageUrl: f.imageUrl, description: f.description, sortOrder: f.sortOrder, isActive: f.isActive },
        });
      }
      toast.success("Saved");
      setEdit(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Small helper so the dialog fields can update either kind of record.
  const patchEdit = (patch: Partial<Category & Family>) =>
    setEdit((cur) => (cur ? ({ ...cur, data: { ...cur.data, ...patch } } as EditTarget) : cur));

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const unlinkedFamilies = families.filter((f) => !f.webCategoryId).length;
  const editTitle =
    edit?.kind === "family" ? "Edit Product Family" : edit && edit.data && (edit.data as Category).parentId ? "Edit Sub Category" : "Edit Main Category";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Website Categories</h2>
        <p className="text-muted-foreground text-sm">
          The shop menu: Main category → Sub category → Product family. Click a row to open the next level. Click a picture (or
          the pencil) to change the name or image.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-sm rounded-lg border bg-muted/30 px-4 py-2.5">
        <span className="text-muted-foreground">Selected:</span>
        {!mainSel ? (
          <span className="text-muted-foreground italic">Pick a main category to start</span>
        ) : (
          <>
            <Chip color="teal" onClick={() => setSubId(null)}>{mainSel.name}</Chip>
            {subSel && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Chip color="violet">{subSel.name}</Chip>
              </>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Column
          step={1}
          title="Main Categories"
          icon={Boxes}
          color="teal"
          items={mains.map(toItem)}
          selectedId={mainId}
          onSelect={(it) => {
            setMainId(it.id);
            setSubId(null);
          }}
          drill
          badge={(it) => it.childCount ?? 0}
          badgeTitle="sub categories"
          addPlaceholder="New main category"
          onAdd={(name) => addCategory(name, null)}
          onEdit={(it) => setEdit({ kind: "category", data: { ...categories.find((c) => c.id === it.id)! } })}
          onDelete={(it) => removeCategory(categories.find((c) => c.id === it.id)!)}
          emptyText="No main categories yet. Add “Wiring Accessories”."
        />
        <Column
          step={2}
          title="Sub Categories"
          subtitle={mainSel ? `in ${mainSel.name}` : undefined}
          icon={FolderOpen}
          color="violet"
          items={subs.map(toItem)}
          selectedId={subId}
          onSelect={(it) => setSubId(it.id)}
          drill
          badge={(it) => families.filter((f) => f.webCategoryId === it.id).length}
          badgeTitle="families"
          disabledText={!mainSel ? "Select a main category to see its sub categories." : undefined}
          addPlaceholder="New sub category"
          onAdd={(name) => addCategory(name, mainId)}
          onEdit={(it) => setEdit({ kind: "category", data: { ...categories.find((c) => c.id === it.id)! } })}
          onDelete={(it) => removeCategory(categories.find((c) => c.id === it.id)!)}
          emptyText="No sub categories yet — e.g. Cables & Wires, Switches & Sockets."
        />
        <Column
          step={3}
          title="Product Families"
          subtitle={subSel ? `in ${subSel.name}` : undefined}
          icon={Layers}
          color="green"
          items={fams.map(famItem)}
          disabledText={!subSel ? "Select a sub category first." : undefined}
          addPlaceholder="New product family"
          onAdd={addFamily}
          onEdit={(it) => setEdit({ kind: "family", data: { ...families.find((f) => f.id === it.id)! } })}
          onDelete={(it) => removeFamily(families.find((f) => f.id === it.id)!)}
          emptyText="No families yet — e.g. Single Core Wires, Twin Flat Wires."
          footer={
            unlinkedFamilies > 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-2 border-t">
                {unlinkedFamilies} families aren’t linked to a sub category — link them on the Product Families page.
              </p>
            ) : null
          }
        />
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTitle}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={edit.data.name} onChange={(e) => patchEdit({ name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Image (shown on the shop menu &amp; category page)</Label>
                <ImageUploader max={1} value={edit.data.imageUrl ? [edit.data.imageUrl] : []} onChange={(u) => patchEdit({ imageUrl: u[0] ?? null })} />
              </div>
              <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Textarea rows={2} value={edit.data.description ?? ""} onChange={(e) => patchEdit({ description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="space-y-1">
                  <Label>Sort order</Label>
                  <Input type="number" value={edit.data.sortOrder} onChange={(e) => patchEdit({ sortOrder: Number(e.target.value) })} />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Switch checked={edit.data.isActive} onCheckedChange={(v) => patchEdit({ isActive: v })} />
                  Show on website
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={saveEdit} disabled={saving || !edit?.data.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ color, onClick, children }: { color: ColorKey; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("px-2 py-0.5 rounded-md font-medium text-xs", COLORS[color].chip, !onClick && "cursor-default")}>
      {children}
    </button>
  );
}

function Column({
  step,
  title,
  subtitle,
  icon: Icon,
  color,
  items,
  selectedId,
  onSelect,
  drill,
  badge,
  badgeTitle,
  disabledText,
  addPlaceholder,
  onAdd,
  onEdit,
  onDelete,
  emptyText,
  footer,
}: {
  step: number;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  color: ColorKey;
  items: Item[];
  selectedId?: string | null;
  onSelect?: (it: Item) => void;
  drill?: boolean;
  badge?: (it: Item) => number;
  badgeTitle?: string;
  disabledText?: string;
  addPlaceholder: string;
  onAdd: (name: string) => Promise<boolean>;
  onEdit: (it: Item) => void;
  onDelete: (it: Item) => void;
  emptyText: string;
  footer?: React.ReactNode;
}) {
  const c = COLORS[color];
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const visible = query.trim() ? items.filter((it) => it.name.toLowerCase().includes(query.trim().toLowerCase())) : items;

  const submitAdd = async () => {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    const ok = await onAdd(name);
    setAdding(false);
    if (ok) setNewName("");
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden min-h-[320px] xl:h-[620px]">
      <div className={cn("px-4 py-3 border-b", c.head)}>
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-background flex items-center justify-center text-xs font-bold shadow-sm">{step}</span>
          <Icon className={cn("h-4 w-4", c.icon)} />
          <h3 className="font-semibold text-sm flex-1">{title}</h3>
          {!disabledText && <span className="text-xs font-medium opacity-70">{items.length}</span>}
        </div>
        {subtitle && !disabledText && <p className="text-xs mt-1 opacity-80 truncate">{subtitle}</p>}
      </div>

      {disabledText ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 text-muted-foreground">
          <Icon className="h-8 w-8 mb-3 opacity-30" />
          <p className="text-sm">{disabledText}</p>
        </div>
      ) : (
        <>
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                placeholder={addPlaceholder}
                className="h-9 text-sm"
                disabled={adding}
              />
              <Button size="sm" className={cn("h-9 px-3 shrink-0", c.sel)} onClick={submitAdd} disabled={!newName.trim() || adding} title="Add">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            {items.length > 6 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="h-8 pl-8 text-xs" />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-[420px] xl:max-h-none">
            {visible.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center px-4 py-8">{query ? `Nothing matches "${query}".` : emptyText}</p>
            ) : (
              visible.map((it) => {
                const selected = it.id === selectedId;
                const n = badge?.(it);
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
                      "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                      onSelect && "cursor-pointer",
                      selected ? c.sel : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(it);
                      }}
                      title={it.imageUrl ? "Change image" : "Add image"}
                      className={cn(
                        "h-9 w-9 rounded-md overflow-hidden shrink-0 flex items-center justify-center border",
                        selected ? "border-white/40 bg-white/10" : "bg-muted/50",
                      )}
                    >
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className={cn("h-4 w-4", selected ? "text-white/70" : "text-muted-foreground/60")} />
                      )}
                    </button>

                    <span className="flex-1 min-w-0">
                      <span className={cn("block text-sm font-medium truncate", !it.isActive && "line-through opacity-60")} title={it.name}>
                        {it.name}
                      </span>
                      <span className={cn("block text-[11px] truncate", selected ? "text-white/75" : "text-muted-foreground")}>
                        {it.productCount} products{!it.isActive && " · hidden"}
                      </span>
                    </span>

                    <span className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(it);
                        }}
                        className={cn("h-6 w-6 rounded flex items-center justify-center", selected ? "hover:bg-white/20" : "hover:bg-background text-muted-foreground hover:text-teal-700")}
                        title="Edit name & image"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(it);
                        }}
                        className={cn("h-6 w-6 rounded flex items-center justify-center", selected ? "hover:bg-white/20" : "hover:bg-background text-muted-foreground hover:text-red-600")}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>

                    {n !== undefined && (
                      <span
                        className={cn("text-[11px] rounded-full px-1.5 min-w-[20px] text-center", selected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}
                        title={`${n} ${badgeTitle ?? ""}`}
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
          {footer}
        </>
      )}
    </div>
  );
}
