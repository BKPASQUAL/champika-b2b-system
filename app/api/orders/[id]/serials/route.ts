import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/[\r\n\t]/g, "")
    .trim()
    .toUpperCase();

// Add one serial number to an order item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const serialNo = clean(body.serialNo);
    const orderItemId = body.orderItemId as string;

    if (!serialNo) {
      return NextResponse.json({ error: "Serial number is empty" }, { status: 400 });
    }
    if (serialNo.length > 100) {
      return NextResponse.json({ error: "Serial number is too long" }, { status: 400 });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, product_id, quantity, free_quantity, products ( name, track_serial )")
      .eq("id", orderItemId)
      .eq("order_id", id)
      .maybeSingle();

    if (itemErr) throw itemErr;
    if (!item) {
      return NextResponse.json({ error: "Item not found in this order" }, { status: 404 });
    }

    const product: any = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product?.track_serial) {
      return NextResponse.json(
        { error: "This product does not use serial numbers" },
        { status: 400 }
      );
    }

    const needed = (Number(item.quantity) || 0) + (Number(item.free_quantity) || 0);
    const { count } = await supabaseAdmin
      .from("order_item_serials")
      .select("id", { count: "exact", head: true })
      .eq("order_item_id", item.id);

    if ((count || 0) >= needed) {
      return NextResponse.json(
        { error: `All ${needed} serial numbers already entered for ${product.name}` },
        { status: 400 }
      );
    }

    // Already sold / scanned somewhere?
    const { data: existing } = await supabaseAdmin
      .from("order_item_serials")
      .select("id, order_id, orders ( order_id, invoice_no )")
      .eq("product_id", item.product_id)
      .eq("serial_no", serialNo) // always stored upper-case
      .limit(1);

    if (existing && existing.length > 0) {
      const e: any = existing[0];
      const o: any = Array.isArray(e.orders) ? e.orders[0] : e.orders;
      const where =
        e.order_id === id
          ? "in this order"
          : `in ${o?.invoice_no || o?.order_id || "another order"}`;
      return NextResponse.json(
        { error: `Serial ${serialNo} is already used ${where}` },
        { status: 409 }
      );
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("order_item_serials")
      .insert({
        order_id: id,
        order_item_id: item.id,
        product_id: item.product_id,
        serial_no: serialNo,
        created_by: body.userId || null,
      })
      .select("id, serial_no")
      .single();

    if (insErr) {
      if ((insErr as any).code === "23505") {
        return NextResponse.json(
          { error: `Serial ${serialNo} is already used` },
          { status: 409 }
        );
      }
      throw insErr;
    }

    return NextResponse.json({ id: inserted.id, serialNo: inserted.serial_no });
  } catch (error: any) {
    console.error("Error adding serial:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Turn serial numbers on / off for a product in this order: { productId, enabled }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { productId, enabled } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const { data: item } = await supabaseAdmin
      .from("order_items")
      .select("id")
      .eq("order_id", id)
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();
    if (!item) {
      return NextResponse.json({ error: "Product is not in this order" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("products")
      .update({ track_serial: !!enabled })
      .eq("id", productId);
    if (error) throw error;

    return NextResponse.json({ success: true, trackSerial: !!enabled });
  } catch (error: any) {
    console.error("Error updating serial setting:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Remove one serial number (?serialId=...)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const serialId = new URL(request.url).searchParams.get("serialId");
    if (!serialId) {
      return NextResponse.json({ error: "serialId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("order_item_serials")
      .delete()
      .eq("id", serialId)
      .eq("order_id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing serial:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
