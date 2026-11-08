import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWebCustomer } from "@/lib/web-auth";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/**
 * Upload a bank transfer slip for one of the customer's own orders.
 * Stored in the private "web-private" bucket; only staff can open it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const customer = await getWebCustomer().catch(() => null);
  if (!customer) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { no } = await params;

  const { data: order } = await supabaseAdmin
    .from("web_orders")
    .select("id, web_order_no, web_customer_id, payment_method, payment_status, status, slip_path")
    .eq("web_order_no", no)
    .maybeSingle();
  if (!order || order.web_customer_id !== customer.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_method !== "BANK") return NextResponse.json({ error: "This order is not paid by bank transfer" }, { status: 400 });
  if (order.payment_status === "verified") return NextResponse.json({ error: "Payment is already confirmed" }, { status: 400 });
  if (order.status === "Cancelled") return NextResponse.json({ error: "This order was cancelled" }, { status: 400 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo or PDF of your slip" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Upload a photo (JPG, PNG) or a PDF" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The file is too large (max 5 MB)" }, { status: 400 });

  const path = `slips/${customer.id}/${order.web_order_no}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("web-private")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });

  const { error } = await supabaseAdmin
    .from("web_orders")
    .update({ slip_path: path, payment_status: "slip_uploaded", updated_at: new Date().toISOString() })
    .eq("id", order.id);
  if (error) return NextResponse.json({ error: "Could not save the slip. Please try again." }, { status: 500 });

  // Replace an earlier slip (keep only the latest).
  if (order.slip_path && order.slip_path !== path) await supabaseAdmin.storage.from("web-private").remove([order.slip_path]);

  return NextResponse.json({ ok: true });
}
