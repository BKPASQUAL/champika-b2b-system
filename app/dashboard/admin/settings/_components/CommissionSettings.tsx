"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Percent,
  Loader2,
  AlertCircle,
  Briefcase,
  Tag,
  Globe, // Icon for "All Categories"
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Types
interface Supplier {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

interface CommissionRule {
  id: string;
  supplierId: string;
  supplierName: string;
  category: string;
  rate: number;
}

export function CommissionSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data Sources
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);

  // Form State
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [commissionRate, setCommissionRate] = useState<string>("");

  // --- 1. Load Data ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [supRes, catRes, rulesRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/settings/categories?type=category"),
        fetch("/api/settings/commissions"),
      ]);

      if (supRes.ok) setSuppliers(await supRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (rulesRes.ok) setRules(await rulesRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load settings data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 2. Handlers ---
  const handleAddRule = async () => {
    // Validate inputs
    if (!selectedSupplier || !selectedCategory || !commissionRate) {
      toast.error("Please select Supplier, Category and enter a Rate.");
      return;
    }

    setSubmitting(true);
    try {
      const supplierObj = suppliers.find((s) => s.id === selectedSupplier);

      const payload = {
        supplierId: selectedSupplier,
        supplierName: supplierObj?.name || "Unknown",
        category: selectedCategory, // This will be "ALL" or a specific category
        rate: parseFloat(commissionRate),
      };

      const res = await fetch("/api/settings/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show the specific error message from the API (e.g. "Rule already exists")
        if (res.status === 409) {
          toast.error(data.error);
        } else {
          toast.error(data.error || "Failed to save rule");
        }
        return;
      }

      toast.success("Commission rule added successfully");

      // Reset Form
      setCommissionRate("");
      setSelectedCategory("");

      // Refresh list
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Error saving rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      const res = await fetch(`/api/settings/commissions?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Rule removed");
      setRules(rules.filter((r) => r.id !== id));
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Left: Add New Rule */}
      <Card className="md:col-span-1 h-fit">
        <CardHeader>
          <CardTitle>Add Commission Rule</CardTitle>
          <CardDescription>
            Set default commission % for specific supplier categories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select
              value={selectedSupplier}
              onValueChange={setSelectedSupplier}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Product Category</Label>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {/* DEFAULT OPTION FOR ALL CATEGORIES */}
                <SelectItem value="ALL" className="text-blue-600 font-semibold">
                  All Categories (Default)
                </SelectItem>

                {/* Main Categories Only */}
                {categories
                  .filter((c) => !c.parent_id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Commission Rate (%)</Label>
            <div className="relative">
              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0.00"
                className="pl-9"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={handleAddRule}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Rule
          </Button>
        </CardContent>
      </Card>

      {/* Right: Active Rules List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Active Commission Rules</CardTitle>
          <CardDescription>
            Specific category rules take priority over "All Categories" rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No commission rules defined yet.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Supplier</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          {rule.supplierName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rule.category === "ALL" ? (
                            <span className="inline-flex items-center text-blue-600 font-medium">
                              <Globe className="w-4 h-4 mr-1" /> All Categories
                            </span>
                          ) : (
                            <span className="inline-flex items-center">
                              <Tag className="w-4 h-4 mr-1 text-muted-foreground" />{" "}
                              {rule.category}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200 font-mono text-sm"
                        >
                          {rule.rate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
