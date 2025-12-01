"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  MapPin,
  Truck, // Import Truck Icon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
  children?: Category[];
}

export function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  // UPDATED: Added "lorry" to activeType
  const [activeType, setActiveType] = useState<
    "category" | "brand" | "model" | "spec" | "supplier" | "route" | "lorry"
  >("route");

  const [selectedParent, setSelectedParent] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/settings/categories?type=${activeType}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      const roots = data.filter((c: Category) => !c.parent_id);
      const withChildren = roots.map((root: Category) => ({
        ...root,
        children: data.filter((c: Category) => c.parent_id === root.id),
      }));

      setCategories(withChildren);
    } catch (error) {
      toast.error("Could not load data");
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useEffect(() => {
    fetchCategories();
    setSelectedParent(null);
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      const payload = {
        name: newName,
        type: activeType,
        parent_id: selectedParent,
      };

      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add");

      toast.success("Item added successfully");
      setNewName("");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to add item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will also delete sub-items.")) return;
    try {
      const res = await fetch(`/api/settings/categories/${id}`, {
        method: "DELETE", //
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Item removed");
      fetchCategories();
    } catch (error) {
      toast.error("Could not delete item");
    }
  };

  const renderList = () => {
    if (categories.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No items found. Add one above.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {categories.map((root) => (
          <div key={root.id} className="border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between group">
              <div
                className={cn(
                  "font-semibold flex items-center gap-2 cursor-pointer",
                  selectedParent === root.id ? "text-blue-600" : ""
                )}
                onClick={() =>
                  setSelectedParent(selectedParent === root.id ? null : root.id)
                }
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    selectedParent === root.id ? "rotate-90" : ""
                  )}
                />
                {root.name}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-blue-600"
                  onClick={() => setSelectedParent(root.id)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Sub
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(root.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive/70" />
                </Button>
              </div>
            </div>

            {root.children && root.children.length > 0 && (
              <div className="ml-6 mt-2 space-y-1 border-l-2 pl-4 border-muted">
                {root.children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between py-1 text-sm group/child"
                  >
                    <span>{child.name}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 opacity-0 group-hover/child:opacity-100"
                      onClick={() => handleDelete(child.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive/70" />
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>System Configurations</CardTitle>
        <CardDescription>
          Manage Categories, Brands, Routes, and Vehicles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeType}
          onValueChange={(v) => setActiveType(v as any)}
          className="w-full"
        >
          {/* UPDATED: Adjusted grid columns and added Lorry Tab */}
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 mb-6 h-auto">
            <TabsTrigger value="route" className="flex gap-2">
              <MapPin className="h-4 w-4" /> Route
            </TabsTrigger>
            <TabsTrigger value="lorry" className="flex gap-2">
              <Truck className="h-4 w-4" /> Lorry
            </TabsTrigger>
            <TabsTrigger value="category">Category</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="spec">Spec</TabsTrigger>
            <TabsTrigger value="supplier">Supplier</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 mb-6 p-4 bg-muted/30 rounded-lg border">
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
