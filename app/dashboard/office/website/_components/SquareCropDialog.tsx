"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VIEW = 320; // on-screen crop box (px)
const OUT = 1200; // saved image size (px), always square

/**
 * 1:1 crop before upload. Starts with the whole picture fitted on a white
 * square; drag to move, slider to zoom. Empty space is filled white so every
 * product photo comes out the same shape.
 */
export function SquareCropDialog({
  file,
  index,
  total,
  onDone,
  onSkip,
  onCancel,
}: {
  file: File | null;
  index: number;
  total: number;
  onDone: (cropped: File) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    el.src = url;
    setSrc(url);
    setImg(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  const fit = VIEW / Math.max(w, h); // zoom 1 = whole picture visible
  const coverZoom = Math.max(w, h) / Math.min(w, h); // zoom that fills the square
  const s = fit * zoom;
  const dw = w * s;
  const dh = h * s;

  const clamp = (p: { x: number; y: number }, z = zoom) => {
    const ss = fit * z;
    const mx = Math.abs(w * ss - VIEW) / 2;
    const my = Math.abs(h * ss - VIEW) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };

  const setZoomClamped = (z: number) => {
    setZoom(z);
    setPos((p) => clamp(p, z));
  };

  const left = VIEW / 2 + pos.x - dw / 2;
  const top = VIEW / 2 + pos.y - dh / 2;

  const save = () => {
    if (!img || !file) return;
    const k = OUT / VIEW;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, left * k, top * k, dw * k, dh * k);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        onDone(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Crop image {total > 1 ? `(${index + 1} of ${total})` : ""}</DialogTitle>
          <DialogDescription>Square 1:1. Drag to move, use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto cursor-move touch-none select-none overflow-hidden rounded-md border bg-white"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setPos(clamp({ x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ left, top, width: dw, height: dh }}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={Math.max(4, coverZoom * 2)}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomClamped(Number(e.target.value))}
            className="flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }}>
            Fit
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setZoom(coverZoom); setPos({ x: 0, y: 0 }); }}>
            Fill
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Use original
          </Button>
          <Button type="button" onClick={save} disabled={!img}>
            Crop &amp; upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
