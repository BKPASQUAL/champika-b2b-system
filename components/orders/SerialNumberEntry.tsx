"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanBarcode, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface SerialEntry {
  id: string;
  serialNo: string;
}

interface Props {
  orderId: string;
  orderItemId: string;
  productName: string;
  needed: number;
  serials: SerialEntry[];
  onChange: (serials: SerialEntry[]) => void;
  userId?: string;
  disabled?: boolean;
}

/**
 * Serial number box for one order item.
 * - USB / Bluetooth barcode scanners type the code and press Enter, so they work in the text box.
 * - "Camera" uses the tablet / phone camera to scan.
 * - The code can also be typed by hand and saved with Enter or "Add".
 */
export function SerialNumberEntry({
  orderId,
  orderItemId,
  productName,
  needed,
  serials,
  onChange,
  userId,
  disabled,
}: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep latest list for back-to-back camera scans
  const serialsRef = useRef(serials);
  useEffect(() => {
    serialsRef.current = serials;
  }, [serials]);

  const complete = serials.length === needed;
  const over = serials.length > needed;

  const addSerial = async (raw: string): Promise<boolean> => {
    const serialNo = raw.replace(/[\r\n\t]/g, "").trim().toUpperCase();
    if (!serialNo) return false;

    const current = serialsRef.current;
    if (current.some((s) => s.serialNo === serialNo)) {
      toast.error(`${serialNo} is already added`);
      return false;
    }
    if (current.length >= needed) {
      toast.error(`All ${needed} serial numbers are already entered`);
      return false;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/serials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, serialNo, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save serial");

      const next = [...serialsRef.current, { id: data.id, serialNo: data.serialNo }];
      serialsRef.current = next;
      onChange(next);
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeSerial = async (serial: SerialEntry) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/orders/${orderId}/serials?serialId=${encodeURIComponent(serial.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not remove serial");
      }
      const next = serialsRef.current.filter((s) => s.id !== serial.id);
      serialsRef.current = next;
      onChange(next);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitTyped = async () => {
    if (saving) return;
    const ok = await addSerial(value);
    if (ok) setValue("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        complete ? "border-emerald-200 bg-emerald-50/50" : "border-blue-200 bg-blue-50/40"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <ScanBarcode className="h-4 w-4 text-blue-600" />
          Serial Numbers
        </span>
        <span
          className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            complete && "bg-emerald-100 text-emerald-700",
            over && "bg-red-100 text-red-700",
            !complete && !over && "bg-amber-100 text-amber-700"
          )}
        >
          {complete && <CheckCircle2 className="inline h-3 w-3 mr-1 -mt-0.5" />}
          {serials.length} / {needed}
        </span>
      </div>

      {over && (
        <p className="text-xs text-red-600">
          Quantity is now {needed}. Remove {serials.length - needed} serial number(s).
        </p>
      )}

      {!complete && !over && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitTyped();
              }
            }}
            placeholder="Scan barcode or type serial no."
            className="h-9 font-mono bg-white"
            // stays enabled while saving so the scanner keeps focus
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 shrink-0"
            onClick={submitTyped}
            disabled={disabled || saving || !value.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 bg-blue-600 hover:bg-blue-700"
            onClick={() => setCameraOpen(true)}
            disabled={disabled || saving}
          >
            <Camera className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Camera</span>
          </Button>
        </div>
      )}

      {serials.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {serials.map((s, i) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 font-mono text-xs text-slate-800"
            >
              <span className="text-slate-400">{i + 1}.</span>
              {s.serialNo}
              {!disabled && (
                <button
                  type="button"
                  className="ml-0.5 rounded text-slate-400 hover:text-red-600 disabled:opacity-50"
                  onClick={() => removeSerial(s)}
                  disabled={saving}
                  aria-label={`Remove ${s.serialNo}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Mounted only while open so each scan session starts fresh */}
      {cameraOpen && (
      <CameraScanDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title={productName}
        remaining={Math.max(0, needed - serials.length)}
        onDetected={addSerial}
      />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera scanner (uses the browser's built-in BarcodeDetector — Chrome on
// Android tablets/phones supports it).
// ---------------------------------------------------------------------------

const FORMATS = [
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "qr_code",
  "data_matrix",
];

function CameraScanDialog({
  open,
  onOpenChange,
  title,
  remaining,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  remaining: number;
  onDetected: (code: string) => Promise<boolean>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const remainingRef = useRef(remaining);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    remainingRef.current = remaining;
    onDetectedRef.current = onDetected;
  }, [remaining, onDetected]);

  // Close by itself once every unit has a serial
  useEffect(() => {
    if (open && remaining === 0) onOpenChange(false);
  }, [open, remaining, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let busy = false;
    const recent = new Map<string, number>(); // code -> time last seen


    const start = async () => {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setError(
          "Camera scanning is not supported in this browser. Use Google Chrome on the tablet, a barcode scanner, or type the serial number."
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available on this device.");
        return;
      }

      let detector: any;
      try {
        const supported: string[] = (await Detector.getSupportedFormats?.()) || FORMATS;
        const formats = FORMATS.filter((f) => supported.includes(f));
        detector = new Detector({ formats: formats.length ? formats : undefined });
      } catch {
        detector = new Detector();
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        setError("Could not open the camera. Please allow camera permission and try again.");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const tick = async () => {
        if (stopped) return;
        if (!busy && video.readyState >= 2 && remainingRef.current > 0) {
          try {
            const codes = await detector.detect(video);
            const raw: string | undefined = codes?.[0]?.rawValue;
            const now = Date.now();
            // Ignore the same code while it stays in front of the camera
            if (raw && now - (recent.get(raw) || 0) > 2500) {
              recent.set(raw, now);
              busy = true;
              setLastCode(raw);
              navigator.vibrate?.(80);
              await onDetectedRef.current(raw);
              busy = false;
            }
          } catch {
            busy = false;
          }
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    };

    start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Scan Serial Number
          </DialogTitle>
          <DialogDescription>
            {title} — {remaining} more to scan. Hold the barcode inside the box.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-1/3 -translate-y-1/2 rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}

        {lastCode && (
          <p className="text-center text-sm">
            Last scanned: <span className="font-mono font-bold">{lastCode}</span>
          </p>
        )}

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
