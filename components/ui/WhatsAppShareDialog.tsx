"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Copy,
  CheckCheck,
  Phone,
  FileText,
  Loader2,
  Link2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
  message: string;
  title?: string;
  /**
   * Optional: provide this to enable the "Attach PDF" button.
   * The function should generate the invoice PDF and return { blob, filename }.
   */
  pdfGenerator?: () => Promise<{ blob: Blob; filename: string }>;
  /**
   * entityType + entityId used to upload the PDF to the attachments store.
   * Required when pdfGenerator is provided.
   */
  entityType?: string;
  entityId?: string;
}

export function WhatsAppShareDialog({
  open,
  onOpenChange,
  phone: defaultPhone = "",
  message: defaultMessage,
  title = "Share via WhatsApp",
  pdfGenerator,
  entityType = "invoice-pdf",
  entityId = "",
}: WhatsAppShareDialogProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  React.useEffect(() => {
    setMessage(defaultMessage);
  }, [defaultMessage]);

  React.useEffect(() => {
    setPhone(defaultPhone);
  }, [defaultPhone]);

  // Reset PDF state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setPdfUrl(null);
      setPdfFilename("");
    }
  }, [open]);

  const cleanPhone = (raw: string) => {
    let cleaned = raw.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("0")) cleaned = "+94" + cleaned.slice(1);
    if (!cleaned.startsWith("+") && cleaned.length === 9) cleaned = "+94" + cleaned;
    return cleaned;
  };

  // ── Generate PDF, upload, and append link to message ─────────────────────
  const handleAttachPdf = async () => {
    if (!pdfGenerator) return;
    setGeneratingPdf(true);
    const tid = toast.loading("Generating PDF...");
    try {
      const { blob, filename } = await pdfGenerator();
      toast.dismiss(tid);
      toast.loading("Uploading PDF...", { id: tid });

      // Upload via existing attachments API
      const fd = new FormData();
      fd.append("file", new File([blob], filename, { type: "application/pdf" }));
      fd.append("entityType", entityType);
      fd.append("entityId", entityId || "shared");
      fd.append("label", "WhatsApp Share");

      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.dismiss(tid);

      const url: string = data.file_url;
      setPdfUrl(url);
      setPdfFilename(filename);

      // Append the PDF link to the message
      setMessage((prev) =>
        prev + `\n\n📎 *Invoice PDF:*\n${url}`
      );

      toast.success("PDF ready — link added to message");
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleRemovePdf = () => {
    if (!pdfUrl) return;
    // Strip the PDF link from the message
    setMessage((prev) =>
      prev.replace(`\n\n📎 *Invoice PDF:*\n${pdfUrl}`, "").trimEnd()
    );
    setPdfUrl(null);
    setPdfFilename("");
  };

  const handleSend = () => {
    const cleaned = cleanPhone(phone);
    if (!cleaned) {
      toast.error("Please enter a phone number");
      return;
    }
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleaned.replace("+", "")}?text=${encoded}`;
    window.open(url, "_blank");
    onOpenChange(false);
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Message copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Recipient Phone Number
            </Label>
            <Input
              placeholder="e.g. 0771234567 or +94771234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sri Lankan numbers (07xxxxxxxx) are auto-converted to +94 format.
            </p>
          </div>

          {/* PDF Attachment — only shown when pdfGenerator is provided */}
          {pdfGenerator && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                PDF Attachment
              </Label>

              {pdfUrl ? (
                /* PDF is ready */
                <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <FileText className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">
                      {pdfFilename}
                    </p>
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-green-600 flex items-center gap-1 hover:underline"
                    >
                      <Link2 className="w-3 h-3" /> Preview PDF link
                    </a>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-none text-xs shrink-0">
                    Linked
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={handleRemovePdf}
                    title="Remove PDF"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                /* Not yet generated */
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-dashed"
                  onClick={handleAttachPdf}
                  disabled={generatingPdf}
                >
                  {generatingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  )}
                  {generatingPdf
                    ? "Generating PDF…"
                    : "Generate & Attach Invoice PDF"}
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                Generates the invoice as a PDF, uploads it, and adds a download
                link to the message. The customer can tap it to open the PDF.
              </p>
            </div>
          )}

          {/* Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Message</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleCopyMessage}
              >
                {copied ? (
                  <CheckCheck className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] max-h-[220px] text-sm font-mono resize-none bg-green-50/40 border-green-200 focus-visible:ring-green-300"
            />
            <p className="text-xs text-muted-foreground">
              You can edit this message before sending.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Open in WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
