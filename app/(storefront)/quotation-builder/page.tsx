"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Printer,
  Download,
  Send,
  Loader2,
  CheckCircle2,
  Zap,
  Phone,
  Building,
  User,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStorefrontCart } from "@/hooks/useStorefrontCart";
import { toast } from "sonner";

export default function QuotationBuilderPage() {
  const { quoteItems, clearQuote, isLoaded } = useStorefrontCart();
  const [items, setItems] = useState<any[]>([]);

  // Project Info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<any | null>(null);

  // Sync quote items from hook
  useEffect(() => {
    if (isLoaded && quoteItems.length > 0 && items.length === 0) {
      setItems(
        quoteItems.map((i) => ({
          productId: i.id,
          sku: i.sku,
          name: i.title,
          unit: i.unit,
          price: i.price,
          quantity: i.quantity,
          total: i.price * i.quantity,
        }))
      );
    }
  }, [isLoaded, quoteItems]);

  // Load catalog for quick-add dropdown
  useEffect(() => {
    fetch("/api/storefront/public/products")
      .then((res) => res.json())
      .then((data) => setCatalogProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleAddItem = (product: any) => {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          sku: product.sku || "-",
          name: product.title,
          unit: product.unit || "Pcs",
          price: product.price,
          quantity: 1,
          total: product.price,
        },
      ]);
    }
    toast.success(`Added ${product.title}`);
  };

  const handleUpdateQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setItems(items.filter((_, i) => i !== idx));
    } else {
      const updated = [...items];
      updated[idx].quantity = qty;
      updated[idx].total = qty * updated[idx].price;
      setItems(updated);
    }
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const subTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Generate Quotation API call
  const handleGenerateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      toast.error("Please enter your name and phone number.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one item to your quotation.");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/storefront/public/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          projectTitle: projectTitle || "Electrical Wiring Estimate",
          deliveryAddress,
          items: items.map((i) => ({
            productId: i.productId,
            sku: i.sku,
            productName: i.name,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.price,
            total: i.total,
          })),
          subTotal,
          grandTotal: subTotal,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quotation");

      setGeneratedQuote(data);
      clearQuote();
      toast.success(`Quotation ${data.quotationNo} generated successfully!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const sendQuoteWhatsApp = () => {
    if (!generatedQuote) return;
    const phone = customerPhone.replace(/[^0-9]/g, "");
    const formattedPhone = phone.startsWith("0") ? `94${phone.slice(1)}` : phone;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const quoteUrl = `${origin}/quotation/${generatedQuote.quotationId}?division=online`;
    const text = encodeURIComponent(
      `Hello ${customerName},\n\nHere is your official *BK WIRING KADE* electrical quotation *#${generatedQuote.quotationNo}* for *${projectTitle || "Electrical Supplies"}*.\n\n💰 Total Estimate: LKR ${fmt(subTotal)}\n\nView and download your official PDF quotation here:\n${quoteUrl}\n\nThank you!`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, "_blank");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          Self-Service BOQ / Quotation Builder
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Generate an Official Electrical Project Quotation
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
          Create an itemized project estimate for bank loans, wireman billings, or home construction budgets. Download clean branded <strong>BK WIRING KADE</strong> PDFs instantly.
        </p>
      </div>

      {generatedQuote ? (
        /* Success Screen */
        <Card className="border-2 border-emerald-500 bg-emerald-50/20 p-6 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">
              Quotation #{generatedQuote.quotationNo} Ready!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Your official estimate for <strong>{projectTitle || "Electrical Installation"}</strong> has been generated under <strong>BK WIRING KADE</strong>.
            </p>
            <div className="text-xl font-extrabold text-emerald-700 pt-2">
              Total Estimate: LKR {fmt(subTotal)}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl gap-2 shadow-lg shadow-emerald-600/20"
              onClick={() => window.open(generatedQuote.downloadUrl, "_blank")}
            >
              <Download className="w-4 h-4" />
              Download / Print PDF
            </Button>
            <Button
              variant="outline"
              className="h-11 px-6 rounded-xl border-slate-300 gap-2 font-bold text-slate-800 hover:bg-white"
              onClick={sendQuoteWhatsApp}
            >
              <Send className="w-4 h-4 text-emerald-600" />
              Share on WhatsApp
            </Button>
            <Button
              variant="ghost"
              className="h-11 px-6 rounded-xl text-xs font-semibold text-slate-600"
              onClick={() => {
                setGeneratedQuote(null);
                setItems([]);
              }}
            >
              Create Another Quote
            </Button>
          </div>
        </Card>
      ) : (
        /* Quotation Form */
        <form onSubmit={handleGenerateQuote} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Project Details & Items Table */}
          <div className="lg:col-span-8 space-y-6">
            {/* Project Details Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building className="w-4 h-4 text-amber-600" />
                  1. Project &amp; Contact Information
                </CardTitle>
                <CardDescription className="text-xs">
                  This will appear on the header of your official quotation PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Project / House Title</label>
                    <Input
                      placeholder="e.g. Silva Residence 1st Floor Wiring"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="mt-1 h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Customer / Contractor Name *</label>
                    <Input
                      placeholder="e.g. K. A. Perera"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="mt-1 h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Phone Number *</label>
                    <Input
                      placeholder="e.g. 0771234567"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                      className="mt-1 h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Delivery Address / Town</label>
                    <Input
                      placeholder="e.g. Galle, Matara, Colombo"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="mt-1 h-10 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Table Card */}
            <Card>
              <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    2. Select Electrical Items &amp; Quantities
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Add cables, modular switch plates, MCBs, and conduit accessories.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Add Product Dropdown */}
                <div className="flex gap-2">
                  <select
                    className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">-- Choose item from electrical catalog --</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.brand}) - LKR {fmt(p.price)} / {p.unit}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={() => {
                      const prod = catalogProducts.find((p) => p.id === selectedProductId);
                      if (prod) {
                        handleAddItem(prod);
                        setSelectedProductId("");
                      } else {
                        toast.error("Please select an item first");
                      }
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-10 rounded-xl gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </Button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl p-6 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">No items added to your quotation yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Select an item from the dropdown above, or browse the{" "}
                      <Link href="/products" className="text-amber-600 font-bold underline">
                        Product Catalog
                      </Link>{" "}
                      and click &ldquo;+ Quote&rdquo;.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Item Description</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Total (LKR)</th>
                          <th className="py-2.5 px-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div>{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{item.sku} &bull; {item.unit}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              LKR {fmt(item.price)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center gap-1.5 border rounded-lg p-0.5 bg-white">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                                  className="w-5 h-5 rounded hover:bg-slate-100 font-bold flex items-center justify-center text-xs"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-bold text-xs">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                                  className="w-5 h-5 rounded hover:bg-slate-100 font-bold flex items-center justify-center text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              LKR {fmt(item.total)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Quote Summary & Generate Action */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="sticky top-24 border-slate-300 shadow-md">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold text-slate-900">Quotation Summary</CardTitle>
                <CardDescription className="text-xs">BK WIRING KADE Official Estimate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Item Types:</span>
                    <span className="font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Quantities:</span>
                    <span className="font-bold text-slate-900">
                      {items.reduce((sum, i) => sum + i.quantity, 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Estimate Validity:</span>
                    <span className="font-bold text-emerald-600">14 Days Guaranteed</span>
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                    <span className="text-xl font-black text-slate-900">LKR {fmt(subTotal)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Special Notes / Requirements</label>
                  <Textarea
                    placeholder="e.g. Include 1 roll of insulation tape per 2 coils, or specific brand preference"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 text-xs resize-none h-20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={generating || items.length === 0}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 gap-2"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Generate Official Quotation (PDF)
                </Button>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Generated under <strong>BK WIRING KADE</strong>. Instant PDF download with clean layout and itemized price breakdown.
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
}
