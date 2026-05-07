import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const LOCK_EXPIRE_MS = 30 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Unlock via POST — used by navigator.sendBeacon on page unload
    if (body.action === "unlock") {
      await supabaseAdmin
        .from("orders")
        .update({ locked_by: null, locked_at: null })
        .eq("id", id);
      return NextResponse.json({ message: "Unlocked" });
    }

    const { lockedBy } = body;
    if (!lockedBy) {
      return NextResponse.json({ error: "lockedBy required" }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("locked_by, locked_at")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (order.locked_by && order.locked_by !== lockedBy) {
      const lockedAt = order.locked_at ? new Date(order.locked_at).getTime() : 0;
      const isExpired = Date.now() - lockedAt > LOCK_EXPIRE_MS;
      if (!isExpired) {
        return NextResponse.json(
          { error: "Order is locked", lockedBy: order.locked_by },
          { status: 409 }
        );
      }
    }

    await supabaseAdmin
      .from("orders")
      .update({ locked_by: lockedBy, locked_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ message: "Locked" });
  } catch (error: any) {
    console.error("Lock error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await supabaseAdmin
      .from("orders")
      .update({ locked_by: null, locked_at: null })
      .eq("id", id);

    return NextResponse.json({ message: "Unlocked" });
  } catch (error: any) {
    console.error("Unlock error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
