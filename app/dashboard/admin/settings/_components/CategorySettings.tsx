"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Tag, Factory, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: "product" | "supplier";
  description?: string;
}

export function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [activeTab, setActiveTab] = useState<"product" | "supplier">("product");
  const [adding, setAdding] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/settings/categories?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      toast.error("Could not load categories");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, type: activeTab }),
      });

      if (!res.ok) throw new Error("Failed to add");

      toast.success(
        `${activeTab === "product" ? "Product" : "Supplier"} category added`
      );
      setNewName("");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to add category");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setCategories(categories.filter((c) => c.id !== id));
      toast.success("Category removed");
    } catch (error) {
      toast.error("Could not delete category");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Categories</CardTitle>
        <CardDescription>
          Manage classifications for products and suppliers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Tabs Component Starts Here */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="product" className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Product Categories
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex items-center gap-2">
              <Factory className="h-4 w-4" /> Supplier Categories
            </TabsTrigger>
          </TabsList>

          {/* Add New Category Input */}
          <div className="flex gap-2 mb-6">
            <Input
              placeholder={`New ${activeTab} category name...`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </Button>
          </div>

          {/* Categories List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-2 bg-gray-50/50">
            {loading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No categories found.
              </div>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm group hover:border-blue-200 transition-colors"
                >
                  <div className="font-medium">{cat.name}</div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-red-50"
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Tabs>
        {/* Tabs Closing Tag was missing in the previous version */}
      </CardContent>
    </Card>
  );
}
