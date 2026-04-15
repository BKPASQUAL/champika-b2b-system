"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  Eye,
  FileText,
  ImageIcon,
  File,
  Loader2,
  Camera,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  label: string | null;
  created_at: string;
}

interface DocumentAttachmentsProps {
  /** The type of the parent record, e.g. "invoice", "purchase", "supplier", "customer" */
  entityType: string;
  /** The UUID of the parent record */
  entityId: string;
  /** Optional section heading override */
  title?: string;
  /** Whether to show the upload area (set false for read-only views) */
  allowUpload?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (mimeType === "application/pdf")
    return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

export function DocumentAttachments({
  entityType,
  entityId,
  title = "Attachments",
  allowUpload = true,
}: DocumentAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/attachments?entityType=${entityType}&entityId=${entityId}`
      );
      if (!res.ok) throw new Error("Failed to load attachments");
      const data = await res.json();
      setAttachments(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const uploadFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File exceeds the 20 MB limit");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", entityType);
      fd.append("entityId", entityId);
      fd.append("label", labelInput.trim());

      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success(`"${file.name}" uploaded`);
      setLabelInput("");
      fetchAttachments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/attachments/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Attachment removed");
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleShare = async (att: Attachment) => {
    // Web Share API — works natively on mobile (Android/iOS)
    if (navigator.share) {
      try {
        await navigator.share({
          title: att.file_name,
          text: att.label || att.file_name,
          url: att.file_url,
        });
      } catch (err: any) {
        // User cancelled — not an error
        if (err?.name !== "AbortError") toast.error("Share failed");
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(att.file_url);
        toast.success("Link copied to clipboard");
      } catch {
        toast.error("Sharing not supported on this browser");
      }
    }
  };

  return (
    <>
      <Card className="shadow-sm border-l-4 border-l-violet-500 overflow-hidden">
        <CardHeader className="bg-violet-50/50 border-b py-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-violet-600" />
              {title}
            </CardTitle>
            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-200 border-none">
              {attachments.length} file{attachments.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Upload Area */}
          {allowUpload && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Label / description (optional)"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="h-9 text-sm flex-1"
                />
                {/* Camera capture button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5 whitespace-nowrap shrink-0"
                  title="Take a photo"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Camera</span>
                </Button>
                {/* File upload button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5 whitespace-nowrap shrink-0"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{uploading ? "Uploading…" : "Upload"}</span>
                </Button>
                {/* Hidden: regular file picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.doc,.docx"
                  onChange={handleFileSelect}
                />
                {/* Hidden: camera capture (opens device camera directly) */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Drag-and-drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors cursor-pointer ${
                  dragOver
                    ? "border-violet-400 bg-violet-50"
                    : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-muted-foreground">
                  Drag & drop a file here, or{" "}
                  <span className="text-violet-600 font-medium">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PDF, Images, Excel, Word — max 20 MB
                </p>
              </div>
            </div>
          )}

          {/* File List */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
              No attachments yet.
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="rounded-lg border bg-white overflow-hidden"
                >
                  {/* Image thumbnail */}
                  {att.file_type.startsWith("image/") && (
                    <div
                      className="w-full bg-slate-100 cursor-pointer"
                      onClick={() => window.open(att.file_url, "_blank")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="w-full max-h-48 object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3 px-3 py-2">
                    {/* Icon (non-image only) */}
                    {!att.file_type.startsWith("image/") && (
                      <div className="shrink-0">
                        <FileIcon mimeType={att.file_type} />
                      </div>
                    )}

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={att.file_name}>
                        {att.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {att.label && (
                          <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                            {att.label}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{formatBytes(att.file_size)}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(att.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions — always visible */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Preview (non-image files only — images are clickable above) */}
                      {!att.file_type.startsWith("image/") && att.file_type === "application/pdf" && (
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          title="Preview"
                          onClick={() => window.open(att.file_url, "_blank")}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Download */}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Download" asChild>
                        <a href={att.file_url} download={att.file_name} target="_blank" rel="noreferrer">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>

                      {/* Share */}
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Share"
                        onClick={() => handleShare(att)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>

                      {/* Delete */}
                      {allowUpload && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50"
                          title="Delete"
                          onClick={() => setDeleteTarget(att)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.file_name}</strong> will be permanently
              deleted and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
