"use client";

import { useState } from "react";
import { Printer, PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { printCheque, amountToWords, type BankTemplate } from "@/app/lib/cheque-print";

export default function ChequeWriterPage() {
  const [form, setForm] = useState({
    payee: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    template: "pan_asia" as BankTemplate,
    notes: "",
  });
  const [acPayeeOnly, setAcPayeeOnly] = useState(true);

  const parsedAmount = parseFloat(form.amount) || 0;

  const canPrint =
    form.payee.trim() !== "" &&
    parsedAmount > 0 &&
    form.date !== "";

  const handlePrint = () => {
    printCheque(form.template, {
      payeeName: form.payee.trim(),
      amount: parsedAmount,
      chequeDate: form.date,
      chequeNumber: "",
      accountName: "",
      acPayeeOnly,
    });
  };

  const handleReset = () => {
    setForm({
      payee: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      template: "pan_asia",
      notes: "",
    });
    setAcPayeeOnly(true);
  };

  // Preview helpers
  const previewDate = form.date
    ? new Date(form.date).toLocaleDateString("en-LK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—  /  —  /  ————";
  const previewWords = parsedAmount > 0 ? amountToWords(parsedAmount) : "";
  const previewFigures =
    parsedAmount > 0
      ? `*** ${new Intl.NumberFormat("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsedAmount)} ***`
      : "";

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <PenLine className="h-6 w-6 text-amber-600" />
          Cheque Writer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the details and print directly onto a physical cheque leaf (Epson L380 rear feed)
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

        {/* ── Form ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

          {/* Payee */}
          <div className="space-y-1.5">
            <Label htmlFor="payee">Payee Name</Label>
            <Input
              id="payee"
              value={form.payee}
              onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
              placeholder="Name of person or company"
              className="w-full"
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (LKR)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full"
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-muted-foreground italic">
                {amountToWords(parsedAmount)}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Cheque Date</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full"
            />
          </div>

          {/* Bank Template */}
          <div className="space-y-1.5">
            <Label>Bank / Cheque Template</Label>
            <Select
              value={form.template}
              onValueChange={(v) => setForm((f) => ({ ...f, template: v as BankTemplate }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-full">
                <SelectItem value="pan_asia">Pan Asia Bank</SelectItem>
                <SelectItem value="ntb">Nations Trust Bank (NTB)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* A/C Payee Only */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Checkbox
              id="ac-payee"
              checked={acPayeeOnly}
              onCheckedChange={(v) => setAcPayeeOnly(!!v)}
            />
            <label htmlFor="ac-payee" className="text-sm font-medium cursor-pointer select-none">
              Print <span className="font-semibold">A/C Payee Only</span> crossing
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {acPayeeOnly ? "Two lines printed" : "No crossing"}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Reference or memo"
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Clear
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!canPrint}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Cheque
            </Button>
          </div>
        </div>

        {/* ── Live Cheque Preview ─────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            Live Preview
          </p>

          {/* Cheque leaf — proportional to 200mm × 85mm */}
          <div
            className="relative w-full border-2 border-dashed border-amber-300 rounded-xl bg-linear-to-br from-amber-50 to-white overflow-hidden shadow-inner"
            style={{ aspectRatio: "200 / 85" }}
          >
            {/* A/C Payee Only crossing lines */}
            {acPayeeOnly && (
              <div
                className="absolute border-t-2 border-b-2 border-gray-700 font-bold text-center flex items-center justify-center"
                style={{
                  top: "10%",
                  left: "35%",
                  width: "24%",
                  paddingTop: "2%",
                  paddingBottom: "2%",
                  fontSize: "clamp(4px, 1.2vw, 9px)",
                }}
              >
                A/C PAYEE ONLY
              </div>
            )}

            {/* Date — top right */}
            <div
              className="absolute font-mono font-bold tracking-wider"
              style={{ top: "10%", right: "4%", fontSize: "clamp(5px, 1.4vw, 11px)" }}
            >
              {previewDate}
            </div>

            {/* Payee line */}
            <div
              className="absolute font-bold truncate border-b border-gray-400"
              style={{
                top: "30%",
                left: "7%",
                right: "12%",
                fontSize: "clamp(6px, 1.5vw, 12px)",
              }}
            >
              {form.payee || (
                <span className="text-gray-300 font-normal">Payee Name</span>
              )}
            </div>

            {/* Amount in words */}
            <div
              className="absolute leading-snug"
              style={{
                top: "48%",
                left: "7%",
                right: "28%",
                fontSize: "clamp(5px, 1.2vw, 10px)",
              }}
            >
              {previewWords || (
                <span className="text-gray-300">Amount in words</span>
              )}
            </div>

            {/* Amount in figures */}
            <div
              className="absolute font-bold font-mono text-right"
              style={{
                top: "47%",
                right: "3%",
                width: "22%",
                fontSize: "clamp(5px, 1.3vw, 10px)",
              }}
            >
              {previewFigures}
            </div>

          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Visual approximation only — exact print positions are calibrated to each bank template
          </p>

          {/* Printer instructions */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">Printing instructions (Epson L380)</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Open the rear manual feed slot</li>
              <li>Insert cheque leaf — top edge first, pushed to the left</li>
              <li>Click <strong>Print Cheque</strong> — the browser print dialog will open</li>
              <li>Select the printer, confirm, then sign the cheque</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
}
