"use client";

import React, { useState } from "react";
import { Printer, Download, Share2, Eye, FileText, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { printInvoice, downloadInvoice, shareInvoice } from "@/app/lib/invoice-print";

interface InvoicePdfPreviewCardProps {
  invoiceId: string;
  invoiceNo?: string;
  divisionKey?: "distribution" | "retail" | "orange" | "sierra" | "wireman" | "admin";
  paymentMethod?: string;
  cashDiscountPercent?: number;
  cashDiscountAmount?: number;
  paymentStatus?: string;
  grandTotal?: number;
}

export function InvoicePdfPreviewCard({
  invoiceId,
  invoiceNo = "",
  divisionKey = "distribution",
  paymentMethod = "",
  cashDiscountPercent = 0,
  cashDiscountAmount = 0,
  paymentStatus = "Unpaid",
  grandTotal = 0,
}: InvoicePdfPreviewCardProps) {
  const [sharing, setSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "details">("preview");

  const handlePrint = () => {
    printInvoice(invoiceId, divisionKey);
  };

  const handleDownload = () => {
    downloadInvoice(invoiceId, divisionKey);
  };

  const handleShare = () => {
    shareInvoice(invoiceId, divisionKey, invoiceNo, setSharing);
  };

  return (
    <Card className="shadow-md border-blue-200 overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 text-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-blue-400" />
              Invoice Bill & PDF Preview
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs sm:text-sm">
              View formatted printable bill for {invoiceNo || invoiceId}
            </CardDescription>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrint}
              className="bg-white hover:bg-slate-100 text-slate-900 font-semibold shadow-xs"
            >
              <Printer className="w-4 h-4 mr-1.5 text-blue-600" />
              Print Bill
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
            >
              <Download className="w-4 h-4 mr-1.5 text-emerald-400" />
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              disabled={sharing}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
            >
              {sharing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-green-400" />
              ) : (
                <Share2 className="w-4 h-4 mr-1.5 text-green-400" />
              )}
              Share
            </Button>
          </div>
        </div>

        {/* Terms & Status Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800 mt-2 text-xs">
          {paymentMethod ? (
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-full text-slate-200">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>Terms: <strong className="text-white">{paymentMethod}</strong></span>
            </div>
          ) : null}
          {cashDiscountAmount > 0 && (
            <Badge variant="outline" className="bg-emerald-950/80 border-emerald-700 text-emerald-300 font-mono">
              Cash Disc: -LKR {cashDiscountAmount.toLocaleString()}{cashDiscountPercent > 0 ? ` (${cashDiscountPercent}%)` : ""}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              paymentStatus.toLowerCase() === "paid"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500"
                : "bg-amber-500/20 text-amber-300 border-amber-500"
            }
          >
            Status: {paymentStatus.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Responsive iframe preview of the formatted printable bill */}
        <div className="w-full bg-slate-100 relative min-h-[420px] max-h-[650px] overflow-hidden border-b">
          <iframe
            src={`/invoice/${invoiceId}`}
            className="w-full h-[550px] border-0"
            title={`Invoice ${invoiceNo}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
