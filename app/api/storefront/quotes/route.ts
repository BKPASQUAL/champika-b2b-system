import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureWebCustomer } from "@/lib/web-auth";
import { QuoteError, createQuote } from "@/lib/web-quotes";

const cartSchema = z.object({
  type: z.literal("cart"),
  items: z.array(z.object({ id: z.string().uuid(), qty: z.coerce.number().int().min(1).max(9999) })).min(1, "Your cart is empty").max(200),
  note: z.string().trim().max(1000).optional().default(""),
});

/** A photo of the electrician's paper item list: the office reads it and prices every line. */
const LIST_PHOTO = "Item list (photo)";
const MAX_FILES = 5;

const POINT_KEYS = ["lights", "switches", "sockets", "fans", "ac", "waterHeater", "gate", "outdoorLights"] as const;
const jobSchema = z.object({
  houseType: z.enum(["New house", "Renovation / rewiring", "Extension", "Shop / office", "Other", LIST_PHOTO]),
  rooms: z.coerce.number().int().min(0).max(100).nullable(),
  floors: z.coerce.number().int().min(1).max(20).nullable(),
  note: z.string().trim().max(2000).optional().default(""),
  points: z.record(z.string(), z.coerce.number().int().min(0).max(999)),
});

const FILE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };

/**
 * Customer asks for a quotation:
 *  - JSON { type: "cart", items, note } — prices are filled in automatically.
 *  - multipart form (house job) with houseType, rooms, floors, points.*, note and up to 5 plan photos.
 *    houseType "Item list (photo)" = just photos of a paper item list (at least one photo).
 */
export async function POST(request: NextRequest) {
  const customer = await ensureWebCustomer().catch(() => null);
  if (!customer) return NextResponse.json({ error: "Please log in to ask for a quotation." }, { status: 401 });
  const tier = customer.tier === "trade" && customer.trade_status === "approved" ? "trade" : "normal";

  try {
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await request.formData();
      const points: Record<string, number> = {};
      for (const k of POINT_KEYS) {
        const v = Number(form.get(`points.${k}`) || 0);
        if (v > 0) points[k] = v;
      }
      const parsed = jobSchema.safeParse({
        houseType: form.get("houseType"),
        rooms: form.get("rooms") || null,
        floors: form.get("floors") || null,
        note: form.get("note") || "",
        points,
      });
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the form" }, { status: 400 });
      const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_FILES);
      const isList = parsed.data.houseType === LIST_PHOTO;
      if (isList && !files.length && !parsed.data.note)
        return NextResponse.json({ error: "Add a photo of your item list, or type the items." }, { status: 400 });
      if (!isList && !Object.keys(parsed.data.points).length && !parsed.data.note)
        return NextResponse.json({ error: "Tell us the number of points, or describe the job in the note." }, { status: 400 });

      // Plan / list photos → private storage.
      const paths: string[] = [];
      for (const file of files) {
        const ext = FILE_TYPES[file.type];
        if (!ext) return NextResponse.json({ error: "Plans must be photos (JPG, PNG) or PDF." }, { status: 400 });
        if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Each file must be under 8 MB." }, { status: 400 });
        const path = `quotes/${customer.id}/${Date.now()}-${paths.length}.${ext}`;
        const { error } = await supabaseAdmin.storage.from("web-private").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
        if (error) return NextResponse.json({ error: "Could not upload your plan. Please try again." }, { status: 500 });
        paths.push(path);
      }

      const q = await createQuote({
        customerId: customer.id,
        tier,
        type: "job",
        job: { houseType: parsed.data.houseType, rooms: parsed.data.rooms, floors: parsed.data.floors, points: parsed.data.points },
        note: parsed.data.note,
        attachmentPaths: paths,
      });
      return NextResponse.json({ quoteNo: q.no }, { status: 201 });
    }

    const parsed = cartSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check your cart" }, { status: 400 });
    const q = await createQuote({
      customerId: customer.id,
      tier,
      type: "cart",
      items: parsed.data.items.map((i) => ({ webProductId: i.id, qty: i.qty })),
      note: parsed.data.note,
    });
    return NextResponse.json({ quoteNo: q.no }, { status: 201 });
  } catch (e) {
    if (e instanceof QuoteError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Quote request failed", e);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
  }
}
