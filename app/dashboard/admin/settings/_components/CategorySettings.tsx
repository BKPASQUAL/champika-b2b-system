"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Copy,
  ChevronRight,
  MapPin,
  Truck,
  Package,
  Tag,
  Layers,
  FileText,
  Building2,
  AlertCircle,
  Check,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
  category_id?: string | null;
  description?: string | null;
  children?: Category[];
}

export function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [fullCategoryList, setFullCategoryList] = useState<Category[]>([]);

  // State for Sub Categories dropdown in Add Model/Spec dialog
  const [availableSubCategories, setAvailableSubCategories] = useState<
    Category[]
  >([]);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    string | null
  >(null);

  // State for models dropdown in the Add Spec dialog
  const [availableModels, setAvailableModels] = useState<Category[]>([]); // Main Models
  const [allCategoryModels, setAllCategoryModels] = useState<Category[]>([]); // All models for filtering
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // State for Sub-Models in Add Spec dialog
  const [availableSubModels, setAvailableSubModels] = useState<Category[]>([]);
  const [selectedSpecSubModelId, setSelectedSpecSubModelId] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
    name: string;
  }>({ open: false, id: null, name: "" });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    id: string | null;
    name: string;
    description: string;
  }>({ open: false, id: null, name: "", description: "" });

  const [cloneDialog, setCloneDialog] = useState<{
    open: boolean;
    sourceId: string | null;
    sourceCategoryId: string | null;
    newName: string;
    cloning: boolean;
    loadingSpecs: boolean;
    specsByParent: Record<string, { id: string; name: string; category_id: string | null }[]>;
  }>({ open: false, sourceId: null, sourceCategoryId: null, newName: "", cloning: false, loadingSpecs: false, specsByParent: {} });

  const [activeType, setActiveType] = useState<
    "category" | "brand" | "model" | "spec" | "supplier" | "route" | "lorry" | "pack_size"
  >("category");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subtab = params.get("subtab") as any;
      if (
        ["category", "brand", "model", "spec", "supplier", "route", "lorry", "pack_size"].includes(subtab)
      ) {
        setActiveType(subtab);
      }
    }
  }, []);

  const handleTypeChange = (value: any) => {
    setActiveType(value);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("subtab", value);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }
  };

  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );

  const tabs = [
    {
      value: "category",
      label: "Categories",
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
      description: "Manage product categories and sub-categories",
    },
    {
      value: "brand",
      label: "Brands",
      icon: Tag,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      borderColor: "border-purple-200 dark:border-purple-800",
      description: "Manage brands and sub-brands",
    },
    {
      value: "model",
      label: "Models",
      icon: Layers,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-200 dark:border-green-800",
      description: "Manage product models by category",
    },
    {
      value: "spec",
      label: "Specifications",
      icon: FileText,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      borderColor: "border-orange-200 dark:border-orange-800",
      description: "Manage product specifications by model",
    },
    {
      value: "route",
      label: "Routes",
      icon: MapPin,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      borderColor: "border-red-200 dark:border-red-800",
      description: "Manage delivery routes",
    },
    {
      value: "lorry",
      label: "Lorries",
      icon: Truck,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
      borderColor: "border-indigo-200 dark:border-indigo-800",
      description: "Manage fleet vehicles",
    },
    {
      value: "supplier",
      label: "Suppliers",
      icon: Building2,
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950/30",
      borderColor: "border-teal-200 dark:border-teal-800",
      description: "Manage supplier categories",
    },
    {
      value: "pack_size",
      label: "Pack Sizes",
      icon: Calculator,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
      borderColor: "border-cyan-200 dark:border-cyan-800",
      description: "Manage packing sizes and base quantity rules",
    },
  ];

  const activeTab = tabs.find((t) => t.value === activeType);

  const fetchAllCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/categories?type=category`);
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setFullCategoryList(data);
      const mainCats = data.filter((c: Category) => !c.parent_id);
      setAllCategories(mainCats);
    } catch (error) {
      console.error("Could not load categories for dropdown");
    }
  }, []);

  const fetchCategories = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/settings/categories?type=${activeType}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      if (activeType === "model" || activeType === "spec") {
        setCategories(data);
      } else {
        const roots = data.filter((c: Category) => !c.parent_id);
        const withChildren = roots.map((root: Category) => ({
          ...root,
          children: data.filter((c: Category) => c.parent_id === root.id),
        }));
        setCategories(withChildren);
      }
    } catch (error) {
      toast.error("Could not load data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeType]);

  // Fetch Sub Categories when Category is selected
  useEffect(() => {
    if (
      (activeType === "model" || activeType === "spec") &&
      selectedCategoryId
    ) {
      const subs = fullCategoryList.filter(
        (c: Category) => c.parent_id === selectedCategoryId
      );
      setAvailableSubCategories(subs);
    } else {
      setAvailableSubCategories([]);
    }
  }, [activeType, selectedCategoryId, fullCategoryList]);

  // Fetch Models when Category is selected (Only for Spec)
  useEffect(() => {
    if (activeType === "spec" && selectedCategoryId) {
      const targetId = selectedSubCategoryId || selectedCategoryId;

      // Fetch ALL models for this category/subcategory
      fetch(`/api/settings/categories?type=model&category_id=${targetId}`)
        .then((res) => res.json())
        .then((data) => {
          setAllCategoryModels(data); // Store EVERYTHING (Main + Subs)

          // Filter to only show Main Models (those without a parent_id)
          const mainModels = data.filter((m: Category) => !m.parent_id);
          setAvailableModels(mainModels);
        })
        .catch((err) => console.error(err));
    } else {
      setAvailableModels([]);
      setAllCategoryModels([]);
    }
  }, [activeType, selectedCategoryId, selectedSubCategoryId]);

  // ✅ UPDATED: Fetch Sub-Models with STRICT FILTERING
  useEffect(() => {
    if (activeType === "spec" && selectedModelId) {
      fetch(`/api/settings/categories?type=model&parent_id=${selectedModelId}`)
        .then((res) => res.json())
        .then((data) => {
          // Double-check filter on client side:
          // 1. Must be type 'model' (not 'spec' which might share the same parent_id)
          // 2. Must specifically match this parent_id
          const strictSubs = data.filter(
            (item: Category) =>
              item.type === "model" && item.parent_id === selectedModelId
          );
          setAvailableSubModels(strictSubs);
        })
        .catch((err) => {
          console.error("Error fetching sub-models:", err);
          setAvailableSubModels([]);
        });
    } else {
      setAvailableSubModels([]);
    }
  }, [activeType, selectedModelId]);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  useEffect(() => {
    fetchCategories();
    setSelectedParent(null);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setSelectedModelId(null);
    setSelectedSpecSubModelId(null);
    setNewName("");
    setNewDescription("");
  }, [fetchCategories]);

  const openAddDialog = (parentId: string | null = null) => {
    setSelectedParent(parentId);
    setNewName("");
    setNewDescription("");
    if (parentId) {
      setSelectedCategoryId(null);
    }
    // Reset selections
    setSelectedSubCategoryId(null);
    setSelectedModelId(null);
    setSelectedSpecSubModelId(null);
    setAddDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (activeType === "model" && !selectedParent && !selectedCategoryId) {
      toast.error("Please select a category for this model");
      return;
    }

    if (activeType === "spec" && !selectedCategoryId) {
      toast.error("Please select a Category");
      return;
    }

    try {
      const payload: any = {
        name: newName.trim(),
        type: activeType,
        parent_id: selectedParent,
        description: activeType === "pack_size" ? newDescription : undefined,
      };

      if (activeType === "model") {
        if (selectedParent) {
          payload.category_id = null; // Sub-models inherit
        } else {
          payload.category_id = selectedSubCategoryId || selectedCategoryId;
        }
      }

      if (activeType === "spec") {
        payload.category_id = selectedSubCategoryId || selectedCategoryId;

        // Priority logic for Parent Link
        payload.parent_id =
          selectedSpecSubModelId ||
          selectedModelId ||
          selectedSubCategoryId ||
          selectedCategoryId;
      }

      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add");

      const newItem: Category = await res.json();

      toast.success(
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>Added successfully</span>
        </div>
      );

      // Refetch table silently
      fetchCategories(true);
      fetchAllCategories();

      setNewName("");
      setNewDescription("");
      setSelectedParent(null);
      setSelectedCategoryId(null);
      setSelectedSubCategoryId(null);
      setSelectedModelId(null);
      setSelectedSpecSubModelId(null);
      setAddDialogOpen(false);
    } catch (error) {
      toast.error("Failed to add item");
    }
  };

  const confirmDelete = (id: string, name: string) => {
    setDeleteDialog({ open: true, id, name });
  };

  const openEditDialog = (id: string, name: string, description: string = "") => {
    setEditDialog({ open: true, id, name, description });
  };

  const handleEdit = async () => {
    if (!editDialog.id || !editDialog.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    try {
      const res = await fetch(`/api/settings/categories/${editDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDialog.name.trim(),
          description: editDialog.description || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>Updated successfully</span>
        </div>
      );
      setEditDialog({ open: false, id: null, name: "", description: "" });
      fetchCategories(true);
      fetchAllCategories();
    } catch (error) {
      toast.error("Failed to update item");
    }
  };

  const openCloneDialog = async (item: Category) => {
    const subModels = categories.filter((c) => c.parent_id === item.id);
    setCloneDialog({
      open: true,
      sourceId: item.id,
      sourceCategoryId: item.category_id || null,
      newName: `Copy of ${item.name}`,
      cloning: false,
      loadingSpecs: true,
      specsByParent: {},
    });

    // Fetch all specs attached to this model and its sub-models
    try {
      const parentIds = [item.id, ...subModels.map((s) => s.id)];
      const url = item.category_id
        ? `/api/settings/categories?type=spec&category_id=${item.category_id}`
        : `/api/settings/categories?type=spec`;
      const res = await fetch(url);
      if (res.ok) {
        const allSpecs: { id: string; name: string; parent_id: string | null; category_id: string | null }[] = await res.json();
        const byParent: Record<string, { id: string; name: string; category_id: string | null }[]> = {};
        allSpecs
          .filter((s) => s.parent_id && parentIds.includes(s.parent_id))
          .forEach((s) => {
            const key = s.parent_id!;
            if (!byParent[key]) byParent[key] = [];
            byParent[key].push({ id: s.id, name: s.name, category_id: s.category_id });
          });
        setCloneDialog((prev) => ({ ...prev, specsByParent: byParent, loadingSpecs: false }));
      } else {
        setCloneDialog((prev) => ({ ...prev, loadingSpecs: false }));
      }
    } catch {
      setCloneDialog((prev) => ({ ...prev, loadingSpecs: false }));
    }
  };

  const handleClone = async () => {
    if (!cloneDialog.sourceId || !cloneDialog.newName.trim()) {
      toast.error("Please enter a name for the new model");
      return;
    }
    setCloneDialog((prev) => ({ ...prev, cloning: true }));

    const postCategory = async (payload: object) => {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create item");
      }
      return res.json();
    };

    try {
      // 1. Create the new model
      const newModel = await postCategory({
        name: cloneDialog.newName.trim(),
        type: "model",
        category_id: cloneDialog.sourceCategoryId,
        parent_id: null,
      });

      // 2. Copy model-level specs
      const modelSpecs = cloneDialog.specsByParent[cloneDialog.sourceId!] || [];
      await Promise.all(
        modelSpecs.map((spec) =>
          postCategory({
            name: spec.name,
            type: "spec",
            parent_id: newModel.id,
            category_id: spec.category_id,
          })
        )
      );

      // 3. Copy sub-models (sequentially so each gets its specs right)
      const subModels = categories.filter((c) => c.parent_id === cloneDialog.sourceId);
      let totalSpecsCopied = modelSpecs.length;

      for (const sub of subModels) {
        const newSub = await postCategory({
          name: sub.name,
          type: "model",
          parent_id: newModel.id,
          category_id: null,
        });

        // Copy this sub-model's specs
        const subSpecs = cloneDialog.specsByParent[sub.id] || [];
        totalSpecsCopied += subSpecs.length;
        await Promise.all(
          subSpecs.map((spec) =>
            postCategory({
              name: spec.name,
              type: "spec",
              parent_id: newSub.id,
              category_id: spec.category_id,
            })
          )
        );
      }

      toast.success(
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>
            Cloned as &quot;{newModel.name}&quot;
            {subModels.length > 0 ? `, ${subModels.length} sub-model${subModels.length !== 1 ? "s" : ""}` : ""}
            {totalSpecsCopied > 0 ? `, ${totalSpecsCopied} spec${totalSpecsCopied !== 1 ? "s" : ""}` : ""}
          </span>
        </div>
      );
      setCloneDialog({ open: false, sourceId: null, sourceCategoryId: null, newName: "", cloning: false, loadingSpecs: false, specsByParent: {} });
      fetchCategories(true);
    } catch (error: any) {
      toast.error(error.message || "Clone failed");
      setCloneDialog((prev) => ({ ...prev, cloning: false }));
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    const deletedId = deleteDialog.id;

    try {
      const res = await fetch(`/api/settings/categories/${deletedId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      toast.success(
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>Deleted successfully</span>
        </div>
      );
      setDeleteDialog({ open: false, id: null, name: "" });

      // Refetch table silently
      fetchCategories(true);
      fetchAllCategories();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const renderCategoryBasedList = () => {
    const groupedByCategory: { [key: string]: Category[] } = {};
    const withoutCategory: Category[] = [];

    categories.forEach((item) => {
      if (item.category_id) {
        if (!groupedByCategory[item.category_id]) {
          groupedByCategory[item.category_id] = [];
        }
        groupedByCategory[item.category_id].push(item);
      } else if (!item.parent_id || activeType === "spec") {
        if (activeType === "spec" && item.parent_id && !item.category_id) {
          // Check if parent_id is actually a category
          const parentIsCategory = fullCategoryList.some(
            (c) => c.id === item.parent_id
          );
          if (parentIsCategory) {
            if (!groupedByCategory[item.parent_id])
              groupedByCategory[item.parent_id] = [];
            groupedByCategory[item.parent_id].push(item);
          } else {
            withoutCategory.push(item);
          }
        } else {
          withoutCategory.push(item);
        }
      }
    });

    const hasItems =
      Object.keys(groupedByCategory).length > 0 || withoutCategory.length > 0;

    if (!hasItems) {
      return (
        <Card
          className={cn(
            "border-2 border-dashed",
            activeTab?.borderColor,
            activeTab?.bgColor
          )}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div
              className={cn(
                "h-20 w-20 rounded-full flex items-center justify-center mb-6",
                activeTab?.bgColor,
                "ring-4 ring-offset-4",
                activeTab?.borderColor?.replace("border-", "ring-")
              )}
            >
              {activeTab && (
                <activeTab.icon className={cn("h-10 w-10", activeTab.color)} />
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              No {activeTab?.label} Yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Get started by adding your first {activeType}.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.keys(groupedByCategory).map((categoryId) => {
          const catEntry = fullCategoryList.find((c) => c.id === categoryId);
          let categoryName = catEntry?.name || "Unknown Category";
          const isSub = catEntry?.parent_id;
          const items = groupedByCategory[categoryId];

          return (
            <Card
              key={categoryId}
              className="overflow-hidden shadow-sm hover:shadow-md transition-shadow h-fit"
            >
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={categoryId} className="border-b-0">
                  <AccordionTrigger
                    className={cn(
                      "px-4 py-3 hover:no-underline",
                      activeTab?.bgColor,
                      "rounded-t-lg data-[state=closed]:rounded-b-lg"
                    )}
                  >
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-background shadow-sm flex items-center justify-center shrink-0">
                          <Package className={cn("h-4 w-4", activeTab?.color)} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold leading-tight">
                            {categoryName}
                          </p>
                          {isSub && (
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              Sub-Category
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 shrink-0">
                        {items.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-0">
                    <Separator />
                    <div className="p-3 space-y-2">
                      {items.map((item) => {
                        const subModels = activeType === "model"
                          ? categories.filter((c) => c.parent_id === item.id)
                          : [];

                        return (
                          <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                            {/* Model / Spec row */}
                            <div className="flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", activeTab?.bgColor)}>
                                  {activeTab && (
                                    <activeTab.icon className={cn("h-3.5 w-3.5", activeTab.color)} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium truncate block">{item.name}</span>
                                  {activeType === "model" && subModels.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {subModels.length} sub-model{subModels.length !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                  {activeType === "spec" &&
                                    (item.parent_id === categoryId || item.parent_id === selectedCategoryId) && (
                                      <span className="text-[10px] text-blue-600 font-semibold bg-blue-100 dark:bg-blue-950 px-1 rounded">
                                        ALL MODELS
                                      </span>
                                    )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {activeType === "model" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openCloneDialog(item)}
                                    className="h-7 w-7 p-0 hover:bg-green-50 hover:text-green-600"
                                    title="Clone model"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(item.id, item.name, item.description || "")}
                                  className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => confirmDelete(item.id, item.name)}
                                  className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Sub-Models list + Add button */}
                            {activeType === "model" && (
                              <div className="px-3 pb-2 pt-1 space-y-1 border-t bg-background">
                                {subModels.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="group flex items-center justify-between pl-3 pr-1 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 text-sm min-w-0">
                                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <span className="truncate">{sub.name}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEditDialog(sub.id, sub.name, sub.description || "")}
                                        className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                                        title="Edit"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => confirmDelete(sub.id, sub.name)}
                                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}

                                {/* Inline Add Sub Model button */}
                                <button
                                  onClick={() => openAddDialog(item.id)}
                                  className="w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors border border-dashed border-muted-foreground/20 hover:border-primary/40 mt-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Sub Model
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          );
        })}

        {withoutCategory.length > 0 && (
          <Card className="border-2 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm h-fit">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="without-category" className="border-b-0">
                <AccordionTrigger className="px-4 hover:no-underline hover:bg-amber-100/50 dark:hover:bg-amber-900/10 rounded-t-lg data-[state=closed]:rounded-b-lg">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-lg text-amber-900 dark:text-amber-500">
                          Not Assigned
                        </CardTitle>
                        <CardDescription className="text-xs text-amber-700 dark:text-amber-400">
                          {withoutCategory.length} item{withoutCategory.length !== 1 ? "s" : ""} need category
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-300 dark:border-amber-700">
                      {withoutCategory.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0">
                  <Separator className="bg-amber-200 dark:bg-amber-900" />
                  <div className="p-3 space-y-1.5">
                    {withoutCategory.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between px-3 py-2 bg-background rounded-lg border hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                      >
                        <span className="text-sm font-medium">{item.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(item.id, item.name, item.description || "")}
                            className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirmDelete(item.id, item.name)}
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        )}
      </div>
    );
  };

  const renderHierarchicalList = () => {
    if (categories.length === 0) {
      return (
        <Card
          className={cn(
            "border-2 border-dashed",
            activeTab?.borderColor,
            activeTab?.bgColor
          )}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div
              className={cn(
                "h-20 w-20 rounded-full flex items-center justify-center mb-6",
                activeTab?.bgColor,
                "ring-4 ring-offset-4",
                activeTab?.borderColor?.replace("border-", "ring-")
              )}
            >
              {activeTab && (
                <activeTab.icon className={cn("h-10 w-10", activeTab.color)} />
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              No {activeTab?.label} Yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Get started by adding your first {activeType}. Click the button
              above to create one.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((item) => (
          <Card
            key={item.id}
            className="overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Card Header */}
            <div className={cn("px-4 py-3 flex items-center justify-between gap-3", activeTab?.bgColor)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-background shadow-sm flex items-center justify-center shrink-0">
                  {activeTab && (
                    <activeTab.icon className={cn("h-4 w-4", activeTab.color)} />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                  {activeType === "pack_size" && item.description ? (
                    <span className="text-xs text-muted-foreground">
                      {item.description} pcs/pack
                    </span>
                  ) : item.children && item.children.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {item.children.length} sub-item{item.children.length !== 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditDialog(item.id, item.name, item.description || "")}
                  className="h-7 w-7 p-0 hover:bg-background/70 hover:text-primary"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirmDelete(item.id, item.name)}
                  className="h-7 w-7 p-0 hover:bg-background/70 hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Children + Add Sub button */}
            {(activeType === "category" || activeType === "brand") && (
              <div className="px-3 py-2 space-y-1 bg-background">
                {item.children && item.children.map((child) => (
                  <div
                    key={child.id}
                    className="group flex items-center justify-between pl-3 pr-1 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-sm min-w-0">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{child.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(child.id, child.name, child.description || "")}
                        className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirmDelete(child.id, child.name)}
                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Inline Add Sub button */}
                <button
                  onClick={() => openAddDialog(item.id)}
                  className="w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors border border-dashed border-muted-foreground/20 hover:border-primary/40 mt-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Sub {activeTab?.label.slice(0, -1)}
                </button>
              </div>
            )}

            {/* For other types (route, lorry, supplier, pack_size) — no sub-items, just a bottom padding */}
            {(activeType === "route" || activeType === "lorry" || activeType === "supplier" || activeType === "pack_size") && (
              <div className="h-1" />
            )}
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Product Settings
            </h2>
            <p className="text-muted-foreground mt-1">
              {activeTab?.description}
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => openAddDialog(null)}
              >
                <Plus className="h-4 w-4" />
                Add {activeTab?.label.slice(0, -1)}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  {activeTab && (
                    <activeTab.icon
                      className={cn("h-5 w-5", activeTab.color)}
                    />
                  )}
                  {selectedParent
                    ? `Add Sub-${activeTab?.label.slice(0, -1)}`
                    : `Add New ${activeTab?.label.slice(0, -1)}`}
                </DialogTitle>
                <DialogDescription>
                  {selectedParent
                    ? `Add a sub-item under "${
                        categories.find((c) => c.id === selectedParent)?.name
                      }"`
                    : `Create a new ${activeType} for your products`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* 1. Category Selector (For Models and Specs) */}
                {(activeType === "model" || activeType === "spec") &&
                  !selectedParent && (
                    <div className="space-y-3">
                      <Label
                        htmlFor="category"
                        className="text-base font-semibold"
                      >
                        Category <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={selectedCategoryId || ""}
                        onValueChange={(val) => {
                          setSelectedCategoryId(val);
                          setSelectedSubCategoryId(null); // Reset Sub
                          setSelectedModelId(null);
                          setSelectedSpecSubModelId(null);
                        }}
                      >
                        <SelectTrigger id="category" className="h-11">
                          <SelectValue placeholder="Select a category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                {/* 2. Sub Category Selector (For Model AND Spec) */}
                {(activeType === "model" || activeType === "spec") &&
                  selectedCategoryId &&
                  !selectedParent && (
                    <div className="space-y-3">
                      <Label
                        htmlFor="subCategory"
                        className="text-base font-semibold"
                      >
                        Sub Category{" "}
                        <span className="text-muted-foreground text-xs">
                          (Optional)
                        </span>
                      </Label>
                      <Select
                        value={selectedSubCategoryId || "none"}
                        onValueChange={(val) => {
                          setSelectedSubCategoryId(val === "none" ? null : val);
                          setSelectedModelId(null);
                          setSelectedSpecSubModelId(null);
                        }}
                      >
                        <SelectTrigger id="subCategory" className="h-11">
                          <SelectValue placeholder="Select a sub-category..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground italic">
                              None (Assign to Main Category)
                            </span>
                          </SelectItem>
                          {availableSubCategories.length > 0 &&
                            availableSubCategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  {sub.name}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                {/* 3. Main Model Selector (ONLY for Specs) - NOW OPTIONAL */}
                {activeType === "spec" && selectedCategoryId && (
                  <div className="space-y-3">
                    <Label htmlFor="model" className="text-base font-semibold">
                      Main Model{" "}
                      <span className="text-muted-foreground text-xs">
                        (Optional - Leave empty to apply to{" "}
                        {selectedSubCategoryId
                          ? "Sub-Category"
                          : "entire Category"}
                        )
                      </span>
                    </Label>
                    <Select
                      value={selectedModelId || "none"}
                      onValueChange={(val) => {
                        setSelectedModelId(val === "none" ? null : val);
                        setSelectedSpecSubModelId(null);
                      }}
                    >
                      <SelectTrigger id="model" className="h-11">
                        <SelectValue placeholder="Select a model (Optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground italic">
                            None (Apply to{" "}
                            {selectedSubCategoryId
                              ? "Sub-Category"
                              : "Category"}
                            )
                          </span>
                        </SelectItem>
                        {availableModels.length > 0 &&
                          availableModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                {m.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 4. Sub Model Selector (ONLY for Specs, if Main Model selected) */}
                {activeType === "spec" && selectedModelId && (
                  <div className="space-y-3">
                    <Label
                      htmlFor="subModel"
                      className="text-base font-semibold"
                    >
                      Sub Model{" "}
                      <span className="text-muted-foreground text-xs">
                        (Optional - Prioritize this)
                      </span>
                    </Label>
                    <Select
                      value={selectedSpecSubModelId || "none"}
                      onValueChange={(val) =>
                        setSelectedSpecSubModelId(val === "none" ? null : val)
                      }
                    >
                      <SelectTrigger id="subModel" className="h-11">
                        <SelectValue placeholder="Select a sub-model (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground italic">
                            None (Assign to Main Model)
                          </span>
                        </SelectItem>
                        {availableSubModels.length > 0 &&
                          availableSubModels.map((sm) => (
                            <SelectItem key={sm.id} value={sm.id}>
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                {sm.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedParent && (
                  <div
                    className={cn(
                      "p-4 rounded-lg",
                      activeTab?.bgColor,
                      activeTab?.borderColor,
                      "border-2"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <ChevronRight
                        className={cn("h-4 w-4", activeTab?.color)}
                      />
                      <span className="font-medium">
                        Adding to:{" "}
                        <strong>
                          {
                            categories.find((c) => c.id === selectedParent)
                              ?.name
                          }
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label htmlFor="name" className="text-base font-semibold">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={`Enter ${activeType} name...`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="h-11"
                    autoFocus
                  />
                </div>

                {activeType === "pack_size" && (
                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-base font-semibold">
                      Pieces per Pack <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="description"
                      type="number"
                      placeholder="e.g. 12"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="h-11"
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddDialogOpen(false);
                    setNewName("");
                    setSelectedParent(null);
                    setSelectedCategoryId(null);
                    setSelectedSubCategoryId(null);
                    setSelectedModelId(null);
                    setSelectedSpecSubModelId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleAdd} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {activeTab?.label.slice(0, -1)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Separator />

        {/* Tabs Section */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTypeChange(tab.value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                "hover:shadow-md",
                activeType === tab.value
                  ? cn(tab.bgColor, tab.borderColor, "shadow-sm")
                  : "border-border hover:border-primary/30 bg-background"
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  activeType === tab.value
                    ? "bg-background shadow-sm"
                    : tab.bgColor
                )}
              >
                <tab.icon className={cn("h-5 w-5", tab.color)} />
              </div>
              <span
                className={cn(
                  "text-sm font-semibold text-center",
                  activeType === tab.value ? tab.color : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Content Section */}
        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : activeType === "model" || activeType === "spec" ? (
          renderCategoryBasedList()
        ) : (
          renderHierarchicalList()
        )}
      </div>

      {/* Clone Dialog */}
      <Dialog
        open={cloneDialog.open}
        onOpenChange={(open) =>
          !open && !cloneDialog.cloning &&
          setCloneDialog({ open: false, sourceId: null, sourceCategoryId: null, newName: "", cloning: false, loadingSpecs: false, specsByParent: {} })
        }
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Copy className="h-5 w-5 text-green-600" />
              Clone Model
            </DialogTitle>
            <DialogDescription>
              Creates a new model with the same sub-models. Give it a new name below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name" className="text-base font-semibold">
                New Model Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clone-name"
                value={cloneDialog.newName}
                onChange={(e) =>
                  setCloneDialog((prev) => ({ ...prev, newName: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && !cloneDialog.cloning && handleClone()}
                className="h-11"
                autoFocus
                disabled={cloneDialog.cloning}
              />
            </div>
            {cloneDialog.sourceId && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 space-y-2 max-h-56 overflow-y-auto">
                {cloneDialog.loadingSpecs ? (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <div className="h-3 w-3 rounded-full border-2 border-green-300 border-t-green-600 animate-spin" />
                    Loading specifications…
                  </div>
                ) : (
                  <>
                    {/* Model-level specs */}
                    {(cloneDialog.specsByParent[cloneDialog.sourceId] || []).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
                          Model Specs ({(cloneDialog.specsByParent[cloneDialog.sourceId] || []).length})
                        </p>
                        {(cloneDialog.specsByParent[cloneDialog.sourceId] || []).map((spec) => (
                          <div key={spec.id} className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500 py-0.5 pl-2">
                            <FileText className="h-2.5 w-2.5 shrink-0" />
                            {spec.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sub-models and their specs */}
                    {categories.filter((c) => c.parent_id === cloneDialog.sourceId).map((sub) => {
                      const subSpecs = cloneDialog.specsByParent[sub.id] || [];
                      return (
                        <div key={sub.id}>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            {sub.name}
                            {subSpecs.length > 0 && (
                              <span className="text-[10px] text-green-500">({subSpecs.length} spec{subSpecs.length !== 1 ? "s" : ""})</span>
                            )}
                          </div>
                          {subSpecs.map((spec) => (
                            <div key={spec.id} className="flex items-center gap-1.5 text-xs text-green-500 dark:text-green-600 py-0.5 pl-6">
                              <FileText className="h-2.5 w-2.5 shrink-0" />
                              {spec.name}
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {/* Empty state */}
                    {categories.filter((c) => c.parent_id === cloneDialog.sourceId).length === 0 &&
                      Object.keys(cloneDialog.specsByParent).length === 0 && (
                        <p className="text-xs text-green-600 dark:text-green-500 italic">No sub-models or specs found.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setCloneDialog({ open: false, sourceId: null, sourceCategoryId: null, newName: "", cloning: false, loadingSpecs: false, specsByParent: {} })
              }
              disabled={cloneDialog.cloning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClone}
              disabled={cloneDialog.cloning || cloneDialog.loadingSpecs || !cloneDialog.newName.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {cloneDialog.cloning ? (
                <>
                  <div className="h-4 w-4 mr-2 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Cloning…
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone Model
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) =>
          !open && setEditDialog({ open: false, id: null, name: "", description: "" })
        }
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {activeTab && (
                <activeTab.icon className={cn("h-5 w-5", activeTab.color)} />
              )}
              Edit {activeTab?.label.slice(0, -1)}
            </DialogTitle>
            <DialogDescription>
              Update the name{activeType === "pack_size" ? " and quantity" : ""} of this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-base font-semibold">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editDialog.name}
                onChange={(e) =>
                  setEditDialog((prev) => ({ ...prev, name: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                className="h-11"
                autoFocus
              />
            </div>
            {activeType === "pack_size" && (
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-base font-semibold">
                  Pieces per Pack
                </Label>
                <Input
                  id="edit-description"
                  type="number"
                  value={editDialog.description}
                  onChange={(e) =>
                    setEditDialog((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="h-11"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditDialog({ open: false, id: null, name: "", description: "" })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          !open && setDeleteDialog({ open: false, id: null, name: "" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{deleteDialog.name}</strong>?
              <br />
              <span className="text-destructive">
                This will also delete all sub-items and cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
