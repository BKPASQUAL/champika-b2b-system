"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Notice, btnDark, btnOutline } from "../../../_components/ui";

/** Upload a photo or PDF of the bank transfer slip. */
export function SlipUpload({ orderNo, hasSlip, advance }: { orderNo: string; hasSlip: boolean; advance?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) return setError("The file is too large (max 5 MB).");
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/storefront/orders/${encodeURIComponent(orderNo)}/${advance ? "advance-slip" : "slip"}`, { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!res.ok) return setError(json.error || "Upload failed. Please try again.");
    toast.success("Slip uploaded. We'll check it soon.");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {hasSlip && (
        <p className="flex items-center gap-2 text-sm font-medium text-(--s-good)">
          <CheckCircle2 className="h-4 w-4" /> Slip received. We are checking your payment.
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={hasSlip ? btnOutline : btnDark}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Uploading…" : hasSlip ? "Upload a different slip" : advance ? "Upload advance slip" : "Upload payment slip"}
      </button>
      <p className="text-xs text-(--s-muted)">Photo or PDF, up to 5 MB.</p>
    </div>
  );
}
