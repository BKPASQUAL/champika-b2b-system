"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SquareCropDialog } from "./SquareCropDialog";

/** Uploads to the public `products` bucket via the existing /api/upload route. */
export function ImageUploader({
  value,
  onChange,
  max = 6,
  crop = false,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  /** Ask for a 1:1 square crop before uploading. */
  crop?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Files waiting for the 1:1 crop dialog, and the ones already cropped.
  const [queue, setQueue] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState<File[]>([]);

  const handleFiles = (list: FileList | null) => {
    // Copy the files BEFORE resetting the input — clearing it empties the FileList.
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    const room = max - value.length;
    if (room <= 0) return toast.error(`Maximum ${max} images`);
    if (!crop) return upload(files.slice(0, room));
    setQueue(files.slice(0, room));
    setStep(0);
    setReady([]);
  };

  const next = (file: File) => {
    const done = [...ready, file];
    if (step + 1 < queue.length) {
      setReady(done);
      setStep(step + 1);
    } else {
      setQueue([]);
      setReady([]);
      upload(done);
    }
  };

  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        urls.push((await res.json()).url);
      }
      onChange([...value, ...urls]);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative h-20 w-20 rounded-md border overflow-hidden bg-white group">
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center">Main</span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center shadow opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <Button
            type="button"
            variant="outline"
            className="h-20 w-20 flex-col gap-1 text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Uploading" : "Add"}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <SquareCropDialog
        file={queue[step] ?? null}
        index={step}
        total={queue.length}
        onDone={next}
        onSkip={() => queue[step] && next(queue[step])}
        onCancel={() => {
          // Closing the dialog still uploads anything already cropped.
          const done = ready;
          setQueue([]);
          setReady([]);
          if (done.length) upload(done);
        }}
      />
    </div>
  );
}
