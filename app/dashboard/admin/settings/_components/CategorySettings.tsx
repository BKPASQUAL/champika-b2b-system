"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
  category_id?: string | null;
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
  const [availableModels, setAvailableModels] = useState<Category[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
    name: string;
  }>({ open: false, id: null, name: "" });

  const [activeType, setActiveType] = useState<
    "category" | "brand" | "model" | "spec" | "supplier" | "route" | "lorry"
  >("category");

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

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }, [activeType]);

  // Fetch Sub Categories when Category is selected (For Model AND Spec)
  useEffect(() => {
    // ✅ UPDATED: Include activeType === "spec"
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
      // ✅ UPDATED: Use Sub Category ID if selected, otherwise Main Category ID
      const targetId = selectedSubCategoryId || selectedCategoryId;

      fetch(`/api/settings/categories?type=model&category_id=${targetId}`)
        .then((res) => res.json())
        .then((data) => {
          const mainModels = data.filter((m: Category) => !m.parent_id);
          setAvailableModels(mainModels);
        })
        .catch((err) => console.error(err));
    } else {
      setAvailableModels([]);
    }
  }, [activeType, selectedCategoryId, selectedSubCategoryId]);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  useEffect(() => {
    fetchCategories();
    setSelectedParent(null);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setSelectedModelId(null);
    setNewName("");
  }, [fetchCategories]);

  const openAddDialog = (parentId: string | null = null) => {
    setSelectedParent(parentId);
    setNewName("");
    if (parentId) {
      setSelectedCategoryId(null);
    }
    // Reset selections
    setSelectedSubCategoryId(null);
    setSelectedModelId(null);
    setAddDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    // Validation for Model/Spec
    if (activeType === "model" && !selectedParent && !selectedCategoryId) {
      toast.error("Please select a category for this model");
      return;
    }

    if (activeType === "spec" && (!selectedCategoryId || !selectedModelId)) {
      toast.error("Please select both a Category and a Main Model");
      return;
    }

    try {
      const payload: any = {
        name: newName.trim(),
        type: activeType,
        parent_id: selectedParent,
      };

      if (activeType === "model") {
        if (selectedParent) {
          payload.category_id = null; // Sub-models inherit
        } else {
          payload.category_id = selectedSubCategoryId || selectedCategoryId;
        }
      }

      if (activeType === "spec") {
        // ✅ UPDATED: Save Sub Category ID if selected
        payload.category_id = selectedSubCategoryId || selectedCategoryId;
        payload.parent_id = selectedModelId;
      }

      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add");

      toast.success(
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>Added successfully</span>
        </div>
      );
      setNewName("");
      setSelectedParent(null);
      setSelectedCategoryId(null);
      setSelectedSubCategoryId(null);
      setSelectedModelId(null);
      setAddDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error("Failed to add item");
    }
  };

  const confirmDelete = (id: string, name: string) => {
    setDeleteDialog({ open: true, id, name });
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      const res = await fetch(`/api/settings/categories/${deleteDialog.id}`, {
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
      fetchCategories();
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
        withoutCategory.push(item);
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
          let categoryName =
            fullCategoryList.find((c) => c.id === categoryId)?.name ||
            "Unknown Category";
          const isSub = fullCategoryList.find(
            (c) => c.id === categoryId
          )?.parent_id;
          if (isSub) categoryName += " (Sub-Category)";

          const items = groupedByCategory[categoryId];

          return (
            <Card
              key={categoryId}
              className="overflow-hidden shadow-sm hover:shadow-md transition-shadow h-fit"
            >
              <CardHeader className={cn("pb-4", activeTab?.bgColor)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        "bg-background shadow-sm"
                      )}
                    >
                      <Package className={cn("h-5 w-5", activeTab?.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {categoryName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {items.length} {activeType}
                        {items.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {items.length}
                  </Badge>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="group flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-all">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-md flex items-center justify-center",
                              activeTab?.bgColor
                            )}
                          >
                            {activeTab && (
                              <activeTab.icon
                                className={cn("h-4 w-4", activeTab.color)}
                              />
                            )}
                          </div>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeType === "model" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddDialog(item.id)}
                              className="h-8"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Sub Model
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirmDelete(item.id, item.name)}
                            className="h-8 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Sub-Models Render */}
                      {activeType === "model" && (
                        <div className="ml-12 space-y-1">
                          {categories
                            .filter((c) => c.parent_id === item.id)
                            .map((sub) => (
                              <div
                                key={sub.id}
                                className="group flex items-center justify-between p-3 rounded-md bg-background border hover:border-primary/50 transition-all"
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">
                                    {sub.name}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    confirmDelete(sub.id, sub.name)
                                  }
                                  className="h-7 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {withoutCategory.length > 0 && (
          <Card className="border-2 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm h-fit">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-amber-900 dark:text-amber-500">
                      Not Assigned to Category
                    </CardTitle>
                    <CardDescription className="text-xs text-amber-700 dark:text-amber-400">
                      These items need to be assigned
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-300 dark:border-amber-700"
                >
                  {withoutCategory.length}
                </Badge>
              </div>
            </CardHeader>
            <Separator className="bg-amber-200 dark:bg-amber-900" />
            <CardContent className="p-4">
              <div className="space-y-2">
                {withoutCategory.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between p-3 bg-background rounded-lg border hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                  >
                    <span className="font-medium">{item.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => confirmDelete(item.id, item.name)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
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
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                        activeTab?.bgColor
                      )}
                    >
                      {activeTab && (
                        <activeTab.icon
                          className={cn("h-6 w-6", activeTab.color)}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-base truncate">
                        {item.name}
                      </h4>
                      {item.children && item.children.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.children.length} sub-item
                          {item.children.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  {(activeType === "category" ||
                    activeType === "brand" ||
                    activeType === "model") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddDialog(item.id)}
                      className="flex-1 h-8"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Sub
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirmDelete(item.id, item.name)}
                    className="h-8 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {item.children && item.children.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      {item.children.map((child) => (
                        <div
                          key={child.id}
                          className="group flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{child.name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirmDelete(child.id, child.name)}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
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

                {/* ✅ 2. Sub Category Selector (For Model AND Spec) */}
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
                        onValueChange={(val) =>
                          setSelectedSubCategoryId(val === "none" ? null : val)
                        }
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

                {/* 3. Model Selector (ONLY for Specs) */}
                {activeType === "spec" && selectedCategoryId && (
                  <div className="space-y-3">
                    <Label htmlFor="model" className="text-base font-semibold">
                      Main Model <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedModelId || ""}
                      onValueChange={setSelectedModelId}
                    >
                      <SelectTrigger id="model" className="h-11">
                        <SelectValue placeholder="Select a model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.length > 0 ? (
                          availableModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                {m.name}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No models found{" "}
                            {selectedSubCategoryId
                              ? "for this sub-category"
                              : ""}
                          </SelectItem>
                        )}
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
              onClick={() => setActiveType(tab.value as any)}
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
