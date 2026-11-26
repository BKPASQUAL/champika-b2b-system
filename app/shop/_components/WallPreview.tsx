"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pipette, Sun } from "lucide-react";

/** Popular interior paint shades customers can try the product against. */
const WALLS = [
  { name: "Pure White", hex: "#f4f3ee" },
  { name: "Ivory", hex: "#eee4cf" },
  { name: "Beige", hex: "#d8c5a4" },
  { name: "Light Grey", hex: "#c9cbcc" },
  { name: "Sky Blue", hex: "#a8c5dd" },
  { name: "Mint", hex: "#b5d6c2" },
  { name: "Sage", hex: "#9aae87" },
  { name: "Blush", hex: "#e6bcb3" },
  { name: "Terracotta", hex: "#c06848" },
  { name: "Mustard", hex: "#d4a53e" },
  { name: "Navy", hex: "#1f2f4d" },
  { name: "Forest", hex: "#2e4a3a" },
  { name: "Charcoal", hex: "#3a3e44" },
];

const cutoutCache = new Map<string, string | null>();

/**
 * Removes the plain studio background from a product photo so it can sit on a
 * coloured wall. Flood-fills from the image border; the background turns
 * transparent and its soft shadow is kept as translucent black, so the item
 * still casts a natural shadow on the new wall. Returns null if the image
 * can't be read (e.g. CORS) or the background isn't uniform.
 */
async function cutOut(src: string): Promise<string | null> {
  if (cutoutCache.has(src)) return cutoutCache.get(src)!;
  const result = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;

        // Background colour = average of the border pixels.
        let br = 0, bg = 0, bb = 0, n = 0;
        const addPx = (x: number, y: number) => {
          const k = (y * w + x) * 4;
          br += px[k]; bg += px[k + 1]; bb += px[k + 2]; n++;
        };
        for (let x = 0; x < w; x++) { addPx(x, 0); addPx(x, h - 1); }
        for (let y = 0; y < h; y++) { addPx(0, y); addPx(w - 1, y); }
        br /= n; bg /= n; bb /= n;
        const bgLum = 0.299 * br + 0.587 * bg + 0.114 * bb;
        if (bgLum < 150) return resolve(null); // not a light studio backdrop

        // Wide enough to swallow the photo's soft studio shadow too (it fades
        // gradually, so the STEP check lets the fill run through it), while the
        // sharp outline of the plate still stops the fill.
        const FAR = 190; // max distance from the backdrop colour
        const STEP = 12; // max change between neighbouring pixels (stops at hard edges)
        const dist = (k: number, r: number, g: number, b: number) =>
          Math.abs(px[k] - r) + Math.abs(px[k + 1] - g) + Math.abs(px[k + 2] - b);

        const seen = new Uint8Array(w * h);
        const stack: number[] = [];
        const seed = (i: number) => {
          if (seen[i]) return;
          const k = i * 4;
          if (dist(k, br, bg, bb) > FAR) return;
          seen[i] = 1;
          stack.push(i);
        };
        for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
        for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }

        while (stack.length) {
          const i = stack.pop()!;
          const k = i * 4;
          const x = i % w;
          const y = (i - x) / w;
          const r = px[k], g = px[k + 1], b = px[k + 2];
          const visit = (j: number) => {
            if (seen[j]) return;
            const kj = j * 4;
            if (dist(kj, r, g, b) > STEP || dist(kj, br, bg, bb) > FAR) return;
            seen[j] = 1;
            stack.push(j);
          };
          if (x > 0) visit(i - 1);
          if (x < w - 1) visit(i + 1);
          if (y > 0) visit(i - w);
          if (y < h - 1) visit(i + w);
        }

        let removed = 0;
        for (let i = 0; i < w * h; i++) {
          if (!seen[i]) continue;
          removed++;
          px[i * 4 + 3] = 0; // backdrop and its shadow → fully transparent
        }
        // Soften the cut edge: half-transparent ring around the removed area.
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (seen[i]) continue;
            if (seen[i - 1] || seen[i + 1] || seen[i - w] || seen[i + w]) px[i * 4 + 3] = 190;
          }
        }
        // Nothing (or almost everything) removed → photo isn't a clean cut-out.
        const ratio = removed / (w * h);
        if (ratio < 0.08 || ratio > 0.97) return resolve(null);

        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null); // tainted canvas etc.
      }
    };
    img.src = src;
  });
  cutoutCache.set(src, result);
  return result;
}

function isDark(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export function WallPreview({ src, name }: { src: string; name: string }) {
  const [wall, setWall] = useState(WALLS[4].hex);
  const [light, setLight] = useState(100); // room brightness %
  const [tone, setTone] = useState(0); // -100 warm … +100 cool
  const [cut, setCut] = useState<string | null | undefined>(cutoutCache.get(src));

  useEffect(() => {
    let alive = true;
    if (cutoutCache.has(src)) setCut(cutoutCache.get(src));
    else {
      setCut(undefined);
      cutOut(src).then((r) => alive && setCut(r));
    }
    return () => {
      alive = false;
    };
  }, [src]);

  const wallName = useMemo(() => WALLS.find((w) => w.hex === wall)?.name ?? "Custom colour", [wall]);
  const toneOverlay =
    tone < 0
      ? `rgba(255, 170, 70, ${(-tone / 100) * 0.22})`
      : `rgba(120, 170, 255, ${(tone / 100) * 0.2})`;

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square overflow-hidden rounded-3xl border border-(--s-line) shadow-[0_8px_30px_-10px_rgba(15,23,42,0.08)]"
        style={{ backgroundColor: wall, filter: `brightness(${light / 100})`, transition: "background-color 300ms" }}
      >
        {/* Subtle paint texture + ceiling-light falloff so the wall doesn't look flat. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.28), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.18), transparent 60%), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center p-[14%]">
          {cut === undefined ? (
            <Loader2 className={`h-8 w-8 animate-spin ${isDark(wall) ? "text-white/70" : "text-black/40"}`} />
          ) : cut ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cut}
              alt={`${name} on a ${wallName.toLowerCase()} wall`}
              className="max-h-full max-w-full object-contain"
              // Thin contact shadow only, like a plate sitting flush on the wall.
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}
            />
          ) : (
            // Fallback when the photo can't be cut out: multiply blend drops the white backdrop.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`${name} on a ${wallName.toLowerCase()} wall`} className="max-h-full max-w-full object-contain mix-blend-multiply" />
          )}
        </div>

        {/* Light tone (warm / cool bulb) */}
        {tone !== 0 && (
          <div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ backgroundColor: toneOverlay }} />
        )}

        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur ${isDark(wall) ? "bg-white/15 text-white" : "bg-black/10 text-black/70"
            }`}
        >
          {wallName}
        </span>
      </div>

      {/* Controls */}
      <div className="space-y-3 rounded-2xl border border-(--s-line) bg-(--s-surface) p-3.5">
        <div>
          <p className="mb-2 text-xs font-semibold text-(--s-ink-2)">Choose your wall colour</p>
          <div className="flex flex-wrap gap-2">
            {WALLS.map((w) => (
              <button
                key={w.hex}
                type="button"
                title={w.name}
                aria-label={w.name}
                onClick={() => setWall(w.hex)}
                className={`h-8 w-8 cursor-pointer rounded-full border border-black/10 transition hover:scale-110 ${wall === w.hex ? "ring-2 ring-blue-600 ring-offset-2 ring-offset-(--s-surface)" : ""
                  }`}
                style={{ backgroundColor: w.hex }}
              />
            ))}
            <label
              title="Pick any colour"
              className={`relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-(--s-line) bg-[conic-gradient(#f43f5e,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#f43f5e)] transition hover:scale-110 ${!WALLS.some((w) => w.hex === wall) ? "ring-2 ring-blue-600 ring-offset-2 ring-offset-(--s-surface)" : ""
                }`}
            >
              <Pipette className="h-4 w-4 text-white drop-shadow" />
              <input
                type="color"
                value={wall}
                onChange={(e) => setWall(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Custom wall colour"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-(--s-ink-2)">
              <Sun className="h-3.5 w-3.5" /> Room light
            </span>
            <input
              type="range"
              min={55}
              max={120}
              value={light}
              onChange={(e) => setLight(+e.target.value)}
              className="w-full accent-blue-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-semibold text-(--s-ink-2)">
              <span>Bulb tone</span>
              <span className="font-normal text-(--s-muted)">{tone < -15 ? "Warm" : tone > 15 ? "Cool" : "Neutral"}</span>
            </span>
            <input
              type="range"
              min={-100}
              max={100}
              value={tone}
              onChange={(e) => setTone(+e.target.value)}
              className="w-full accent-blue-600"
            />
          </label>
        </div>
        <p className="text-[11px] text-(--s-muted)">Preview only — real paint and lighting may look slightly different.</p>
      </div>
    </div>
  );
}
