"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ClipboardList, FileText, Home, ImagePlus, Loader2, Minus, Plus, X } from "lucide-react";
import { useShop } from "../_components/ShopContext";
import { Field, Notice, btnPrimary, cardCls, inputCls } from "../_components/ui";
import { whatsappLink } from "../_components/format";
import { WhatsAppIcon } from "../_components/WhatsAppButton";

const HOUSE_TYPES = ["New house", "Renovation / rewiring", "Extension", "Shop / office", "Other"];
/** Must match LIST_PHOTO in /api/storefront/quotes. */
const LIST_PHOTO = "Item list (photo)";
const MAX_FILES = 5;
export type QuoteMode = "list" | "house";
const POINTS: { key: string; label: string; hint: string }[] = [
  { key: "lights", label: "Light points", hint: "Bulbs / tube lights" },
  { key: "switches", label: "Switches", hint: "1-way, 2-way" },
  { key: "sockets", label: "Plug sockets", hint: "5A / 13A / 15A" },
  { key: "fans", label: "Fans", hint: "Ceiling / wall fans" },
  { key: "ac", label: "A/C units", hint: "Air conditioners" },
  { key: "waterHeater", label: "Water heaters", hint: "Geysers / showers" },
  { key: "outdoorLights", label: "Outdoor lights", hint: "Garden / gate" },
  { key: "gate", label: "Gate motor / bell", hint: "Auto gate, bell" },
];

/** "Get one price for my house" — the office builds the item list from this. */
export function JobQuoteForm({ initialMode = "house" }: { initialMode?: QuoteMode }) {
  const { href, store, t } = useShop();
  const [mode, setMode] = useState<QuoteMode>(initialMode);
  const isList = mode === "list";
  const waList = whatsappLink(store.whatsapp, "Hi, I am sending a photo of my wiring item list. Please send me a quotation.");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [houseType, setHouseType] = useState(HOUSE_TYPES[0]);
  const [rooms, setRooms] = useState("3");
  const [floors, setFloors] = useState("1");
  const [points, setPoints] = useState<Record<string, number>>({ lights: 10, switches: 8, sockets: 10, fans: 3 });
  const [note, setNote] = useState("");
  const [listText, setListText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bump = (k: string, d: number) => setPoints((p) => ({ ...p, [k]: Math.max(0, Math.min(999, (p[k] || 0) + d)) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const typed = listText.trim();
    if (isList && !files.length && !typed) return setError(t("Add a photo of your item list, or type the items."));
    setBusy(true);
    const form = new FormData();
    form.append("houseType", isList ? LIST_PHOTO : houseType);
    form.append("note", isList && typed ? `Item list:\n${typed}${note.trim() ? `\n\nNotes: ${note.trim()}` : ""}` : note);
    if (!isList) {
      form.append("rooms", rooms);
      form.append("floors", floors);
      for (const [k, v] of Object.entries(points)) if (v > 0) form.append(`points.${k}`, String(v));
    }
    for (const f of files) form.append("files", f);
    try {
      const res = await fetch("/api/storefront/quotes", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) return router.replace(`${href("/login")}?next=${encodeURIComponent(isList ? "/quote?mode=list" : "/quote")}`);
      if (!res.ok) throw new Error(json.error || "Could not send your request.");
      router.replace(`${href(`/account/quotes/${json.quoteNo}`)}?sent=1`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--s-accent) text-(--s-accent-ink)">
          <ClipboardList className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold md:text-[28px]">{t("Get one price for your whole house")}</h1>
          <p className="mt-1 text-(--s-ink-2)">{t("We'll send a complete item list with our best discount — usually within one working day.")}</p>
        </div>
      </div>

      {/* Two ways to ask: a photo of a paper list, or describe the house */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {([
          ["list", Camera, t("I have a list (photo)"), t("Send a photo of your electrician's list")],
          ["house", Home, t("Describe my house"), t("Rooms, lights, plugs and fans")],
        ] as const).map(([key, Icon, title, sub]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setError(null);
            }}
            className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition ${
              mode === key ? "border-(--s-accent) bg-(--s-accent-soft)" : "border-(--s-line) bg-(--s-surface) hover:border-(--s-accent)/50"
            }`}
          >
            <Icon className={`h-6 w-6 ${mode === key ? "text-(--s-accent)" : "text-(--s-muted)"}`} />
            <span className="text-base font-bold text-(--s-ink)">{title}</span>
            <span className="text-sm text-(--s-muted)">{sub}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-5">
        {isList && (
          <section className={`space-y-4 p-5 sm:p-6 ${cardCls}`}>
            <h2 className="font-bold">{t("Your item list")}</h2>
            <p className="text-sm text-(--s-muted)">{t("Add clear photos of every page (up to 5), or type the items below — no photo needed.")}</p>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-2 rounded-xl bg-(--s-soft) px-3 py-2 text-sm">
                  {f.type === "application/pdf" ? <FileText className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                  <span className="max-w-40 truncate">{f.name}</span>
                  <button type="button" aria-label="Remove" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4 text-(--s-muted) hover:text-(--s-bad)" />
                  </button>
                </span>
              ))}
            </div>
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-(--s-accent)/50 bg-(--s-accent-soft)/40 px-4 py-8 text-(--s-accent) transition hover:bg-(--s-accent-soft)"
              >
                <Camera className="h-9 w-9" />
                <span className="text-base font-bold">{files.length ? t("Add another photo") : t("Take or choose a photo")}</span>
              </button>
            )}
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-(--s-muted)">
              <span className="h-px flex-1 bg-(--s-line)" /> {t("or type your list")} <span className="h-px flex-1 bg-(--s-line)" />
            </div>
            <Field label={t("Items and quantities")} hint={t("One item per line, e.g. 1/1.13 wire – 2 coils, 13A socket – 10")}>
              <textarea
                className={`${inputCls} h-40 resize-y py-3`}
                value={listText}
                maxLength={1200}
                placeholder={"7/0.67 earth wire – 1 coil\n1 gang 1 way switch – 12\n13A socket – 8\nMCB 32A – 2"}
                onChange={(e) => setListText(e.target.value)}
              />
            </Field>
            {waList && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-(--s-muted)">
                {t("Easier on WhatsApp?")}
                <a href={waList} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-1.5 font-bold text-white hover:bg-[#1ebe5a]">
                  <WhatsAppIcon className="h-4 w-4" /> {t("Send on WhatsApp")}
                </a>
              </p>
            )}
          </section>
        )}

        {!isList && (
        <>
        <section className={`space-y-4 p-5 sm:p-6 ${cardCls}`}>
          <h2 className="font-bold">{t("About the job")}</h2>
          <div className="flex flex-wrap gap-2">
            {HOUSE_TYPES.map((ht) => (
              <button
                key={ht}
                type="button"
                onClick={() => setHouseType(ht)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  houseType === ht ? "border-(--s-accent) bg-(--s-accent) text-(--s-accent-ink)" : "border-(--s-line) hover:border-(--s-ink)"
                }`}
              >
                {ht}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rooms (incl. kitchen, bathrooms)">
              <input className={inputCls} inputMode="numeric" value={rooms} onChange={(e) => setRooms(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </Field>
            <Field label="Floors">
              <input className={inputCls} inputMode="numeric" value={floors} onChange={(e) => setFloors(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </Field>
          </div>
        </section>

        <section className={`p-5 sm:p-6 ${cardCls}`}>
          <h2 className="font-bold">How many points?</h2>
          <p className="text-sm text-(--s-muted)">A rough count is fine — we'll check with you.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {POINTS.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 rounded-2xl border border-(--s-line) px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-(--s-muted)">{p.hint}</div>
                </div>
                <div className="flex items-center rounded-full border border-(--s-line)">
                  <button type="button" aria-label={`Less ${p.label}`} onClick={() => bump(p.key, -1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-(--s-soft)">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    aria-label={p.label}
                    inputMode="numeric"
                    value={points[p.key] || 0}
                    onChange={(e) => setPoints((x) => ({ ...x, [p.key]: Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 0) }))}
                    className="w-10 bg-transparent text-center text-sm font-bold outline-none"
                  />
                  <button type="button" aria-label={`More ${p.label}`} onClick={() => bump(p.key, 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-(--s-soft)">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        </>
        )}

        <section className={`space-y-4 p-5 sm:p-6 ${cardCls}`}>
          <h2 className="font-bold">{t("Anything else?")}</h2>
          <Field label="Notes (optional)" hint="Preferred brands, budget, distribution board, special needs…">
            <textarea className={`${inputCls} h-28 resize-none py-3`} value={note} maxLength={isList ? 700 : 2000} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {!isList && (
          <div>
            <span className="text-[14px] font-medium text-(--s-ink-2)">{t("House plan or photos (optional, up to 5)")}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-2 rounded-xl bg-(--s-soft) px-3 py-2 text-sm">
                  {f.type === "application/pdf" ? <FileText className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                  <span className="max-w-40 truncate">{f.name}</span>
                  <button type="button" aria-label="Remove" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4 text-(--s-muted) hover:text-(--s-bad)" />
                  </button>
                </span>
              ))}
              {files.length < MAX_FILES && (
                <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-xl border border-dashed border-(--s-line) px-4 py-2 text-sm hover:border-(--s-ink)">
                  <ImagePlus className="h-4 w-4" /> {t("Add plan / photo")}
                </button>
              )}
            </div>
          </div>
          )}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                const big = picked.find((f) => f.size > 8 * 1024 * 1024);
                if (big) setError(`${big.name} is too large (max 8 MB).`);
                setFiles((x) => [...x, ...picked.filter((f) => f.size <= 8 * 1024 * 1024)].slice(0, MAX_FILES));
                e.target.value = "";
              }}
            />
        </section>

        {error && <Notice tone="error">{error}</Notice>}
        <button disabled={busy} className={`w-full ${btnPrimary} h-12 text-base`}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" />} {t("Send my request")}
        </button>
      </form>
    </div>
  );
}
