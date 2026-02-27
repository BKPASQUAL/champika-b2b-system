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
  Globe,
  ArrowRight,
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
  subCategory?: string | null;
  rate: number;
}

export function CommissionSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);

  // Form State
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("ALL");
  const [commissionRate, setCommissionRate] = useState<string>("");

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; supplierName: string; category: string }>({
    open: false, id: null, supplierName: "", category: "",
  });

  const subCategoryOptions = React.useMemo(() => {
    if (!selectedCategory || selectedCategory === "ALL") return [];
    const parentCat = categories.find((c) => c.name === selectedCategory && !c.parent_id);
    if (!parentCat) return [];
    return categories.filter((c) => c.parent_id === parentCat.id);
  }, [selectedCategory, categories]);

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
    } catch {
      toast.error("Failed to load settings data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSelectedSubCategory("ALL"); }, [selectedCategory]);

  const handleAddRule = async () => {
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
        category: selectedCategory,
        subCategory: selectedSubCategory === "ALL" ? null : selectedSubCategory,
        rate: parseFloat(commissionRate),
      };

      const res = await fetch("/api/settings/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save rule"); return; }

      toast.success("Commission rule added successfully");
      setCommissionRate("");
      setSelectedCategory("");
      setSelectedSubCategory("ALL");
      fetchData();
    } catch {
      toast.error("Error saving rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteDialog.id) return;
    try {
      const res = await fetch(`/api/settings/commissions?id=${deleteDialog.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Rule removed");
      setRules(rules.filter((r) => r.id !== deleteDialog.id));
      setDeleteDialog({ open: false, id: null, supplierName: "", category: "" });
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Commission Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the commission rule for <strong>{deleteDialog.supplierName}</strong> on <strong>{deleteDialog.category}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-red-600 hover:bg-red-700 text-white">
              Remove Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-rose-600 to-pink-500 flex items-center justify-center shadow-md shadow-rose-200">
              <Percent className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Commission Rules</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Set commission % per supplier and category
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
            {rules.length} active rule{rules.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left: Add Rule */}
          <Card className="md:col-span-1 h-fit border-rose-100 shadow-sm">
            <CardHeader className="pb-4 bg-rose-50/50 rounded-t-xl">
              <CardTitle className="text-base text-rose-800">Add Commission Rule</CardTitle>
              <CardDescription>Set commission % for specific categories or sub-categories.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Supplier</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-blue-600 font-semibold">
                      All Categories (Global)
                    </SelectItem>
                    {categories.filter((c) => !c.parent_id).map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && selectedCategory !== "ALL" && subCategoryOptions.length > 0 && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-sm font-semibold">Sub-Category <span className="text-xs text-muted-foreground font-normal">(Optional)</span></Label>
                  <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Sub-Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-muted-foreground italic">
                        Apply to entire &quot;{selectedCategory}&quot;
                      </SelectItem>
                      {subCategoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Commission Rate (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-9"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    min="0" max="100" step="0.01"
                  />
                </div>
              </div>

              <Button
                className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
                onClick={handleAddRule}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Rule
              </Button>
            </CardContent>
          </Card>

          {/* Right: Rules List */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Active Commission Rules</CardTitle>
              <CardDescription>
                Rules are applied from most specific (Sub-Category) to least specific (All).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl border-rose-200 bg-rose-50/30">
                  <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3 opacity-70" />
                  <h3 className="text-base font-semibold text-gray-700">No Rules Defined</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add your first commission rule using the form.</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Supplier</TableHead>
                        <TableHead className="font-semibold">Category / Sub-Category</TableHead>
                        <TableHead className="text-right font-semibold">Commission</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule) => (
                        <TableRow key={rule.id} className="hover:bg-rose-50/20">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-rose-100 flex items-center justify-center">
                                <Briefcase className="w-3.5 h-3.5 text-rose-600" />
                              </div>
                              <span className="font-semibold text-gray-800">{rule.supplierName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {rule.category === "ALL" ? (
                              <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium text-sm">
                                <Globe className="w-3.5 h-3.5" /> All Categories
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 text-sm">
                                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>{rule.category}</span>
                                {rule.subCategory && (
                                  <>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-semibold text-gray-800">{rule.subCategory}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-sm">
                              {rule.rate}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteDialog({ open: true, id: rule.id, supplierName: rule.supplierName, category: rule.category })}
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
      </div>
    </>
  );
}
