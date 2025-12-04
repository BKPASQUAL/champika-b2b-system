// app/dashboard/admin/settings/_components/CategorySettings.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronRight, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [allCategories, setAllCategories] = useState<Category[]>([]); // For category dropdown
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const [activeType, setActiveType] = useState<
    "category" | "brand" | "model" | "spec" | "supplier" | "route" | "lorry"
  >("category");

  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  ); // For Model/Spec

  // Fetch all main categories for the dropdown
  const fetchAllCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/categories?type=category`);
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
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
        // For models and specs, group by category_id
        setCategories(data);
      } else {
        // For others, build parent-child hierarchy
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

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  useEffect(() => {
    fetchCategories();
    setSelectedParent(null);
    setSelectedCategoryId(null);
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    // Validation for models and specs
    if (
      (activeType === "model" || activeType === "spec") &&
      !selectedParent &&
      !selectedCategoryId
    ) {
      toast.error(`Please select a category for this ${activeType}`);
      return;
    }

    try {
      const payload: any = {
        name: newName,
        type: activeType,
        parent_id: selectedParent,
      };

      // Add category_id for models and specs
      if (activeType === "model" || activeType === "spec") {
        if (selectedParent) {
          // Adding sub-model (child of model)
          payload.category_id = null; // Sub-models inherit category from parent
        } else {
          // Adding main model or spec
          payload.category_id = selectedCategoryId;
        }
      }

      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add");

      toast.success("Item added successfully");
      setNewName("");
      setSelectedParent(null);
      if (!selectedParent) setSelectedCategoryId(null); // Reset category selection only for main items
      fetchCategories();
    } catch (error) {
      toast.error("Failed to add item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will also delete sub-items.")) return;

    try {
      const res = await fetch(`/api/settings/categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Deleted successfully");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const renderList = () => {
    if (activeType === "model" || activeType === "spec") {
      // Group by category
      const groupedByCategory: { [key: string]: Category[] } = {};
      const withoutCategory: Category[] = [];

      categories.forEach((item) => {
        if (item.category_id) {
          if (!groupedByCategory[item.category_id]) {
            groupedByCategory[item.category_id] = [];
          }
          groupedByCategory[item.category_id].push(item);
        } else if (!item.parent_id) {
          withoutCategory.push(item);
        }
      });

      return (
        <div className="space-y-6">
          {Object.keys(groupedByCategory).map((categoryId) => {
            const category = allCategories.find((c) => c.id === categoryId);
            const items = groupedByCategory[categoryId];

            return (
              <div
                key={categoryId}
                className="border rounded-lg p-4 bg-muted/10"
              >
                <h3 className="font-semibold text-lg mb-3 text-primary">
                  {category?.name || "Unknown Category"}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id}>
                      <div className="flex items-center justify-between p-3 bg-background rounded-md border hover:bg-muted/50 transition-colors">
                        <span className="font-medium">{item.name}</span>
                        <div className="flex gap-2">
                          {activeType === "model" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedParent(item.id);
                                setSelectedCategoryId(null);
                              }}
                            >
                              <ChevronRight className="h-4 w-4 mr-1" />
                              Add Sub Model
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* Show sub-models */}
                      {activeType === "model" && (
                        <div className="ml-6 mt-2 space-y-1">
                          {categories
                            .filter((c) => c.parent_id === item.id)
                            .map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
                              >
                                <span className="flex items-center gap-2">
                                  <ChevronRight className="h-3 w-3" />
                                  {sub.name}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(sub.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {withoutCategory.length > 0 && (
            <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20">
              <h3 className="font-semibold text-lg mb-3 text-amber-700 dark:text-amber-500">
                ⚠️ Not Assigned to Category
              </h3>
              <div className="space-y-2">
                {withoutCategory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-background rounded-md border"
                  >
                    <span className="font-medium">{item.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default hierarchical list for other types
    return (
      <div className="space-y-2">
        {categories.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border hover:bg-muted transition-colors">
              <span className="font-medium">{item.name}</span>
              <div className="flex gap-2">
                {(activeType === "category" ||
                  activeType === "brand" ||
                  activeType === "model") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedParent(item.id);
                      setSelectedCategoryId(null);
                    }}
                  >
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Add Sub
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>

            {item.children && item.children.length > 0 && (
              <div className="ml-6 space-y-1">
                {item.children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-2 bg-background rounded-md border text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      {child.name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(child.id)}
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Categories & Settings</CardTitle>
        <CardDescription>
          Manage categories, brands, models, specifications, and logistics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeType}
          onValueChange={(v) => setActiveType(v as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 mb-6 h-auto">
            <TabsTrigger value="category">Category</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="spec">Spec</TabsTrigger>
            <TabsTrigger value="route" className="flex gap-2">
              <MapPin className="h-4 w-4" /> Route
            </TabsTrigger>
            <TabsTrigger value="lorry" className="flex gap-2">
              <Truck className="h-4 w-4" /> Lorry
            </TabsTrigger>
            <TabsTrigger value="supplier">Supplier</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-3 mb-6 p-4 bg-muted/30 rounded-lg border">
            {/* Category selection for Models and Specs */}
            {(activeType === "model" || activeType === "spec") &&
              !selectedParent && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Select Category *
                  </label>
                  <Select
                    value={selectedCategoryId || ""}
                    onValueChange={setSelectedCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            <div className="flex gap-2">
              <Input
                placeholder={
                  selectedParent
                    ? `Add Sub-item under "${
                        categories.find((c) => c.id === selectedParent)?.name
                      }"...`
                    : `New ${
                        activeType.charAt(0).toUpperCase() + activeType.slice(1)
                      }...`
                }
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>

            {selectedParent && (
              <div className="text-xs text-muted-foreground flex justify-between items-center">
                <span>
                  Adding to parent:{" "}
                  <strong>
                    {categories.find((c) => c.id === selectedParent)?.name}
                  </strong>
                </span>
                <button
                  onClick={() => setSelectedParent(null)}
                  className="text-blue-500 hover:underline"
                >
                  Cancel selection
                </button>
              </div>
            )}

            {(activeType === "model" || activeType === "spec") &&
              selectedCategoryId &&
              !selectedParent && (
                <div className="text-xs text-muted-foreground flex justify-between items-center">
                  <span>
                    Category:{" "}
                    <strong>
                      {
                        allCategories.find((c) => c.id === selectedCategoryId)
                          ?.name
                      }
                    </strong>
                  </span>
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className="text-blue-500 hover:underline"
                  >
                    Change category
                  </button>
                </div>
              )}
          </div>

          {loading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : (
            renderList()
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
