import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  try {
    const body = await req.json();
    const {
      sourceLocationId,
      destLocationId,
      items,
      reason,
      transferDate,
      transferType = "Good", // Default to Good
    } = body;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!sourceLocationId || !destLocationId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Generate Transfer Number
    const transferNo = `TRN-${Date.now().toString().slice(-6)}`;

    // 2. Create Transfer Record
    const { data: transfer, error: transferError } = await supabase
      .from("stock_transfers")
      .insert({
        transfer_no: transferNo,
        source_location_id: sourceLocationId,
        dest_location_id: destLocationId,
        reason: `${reason} [${transferType}]`, // Tag the type in reason
        transfer_date: transferDate,
        created_by: user.id,
        status: "Completed",
      })
      .select()
      .single();

    if (transferError) throw transferError;

    // 3. Process Items
    for (const item of items) {
      const { productId, quantity } = item;
      const qty = Number(quantity);

      // A. Verify Source Stock
      const { data: sourceStock } = await supabase
        .from("product_stocks")
        .select("*")
        .eq("product_id", productId)
        .eq("location_id", sourceLocationId)
        .single();

      if (!sourceStock) {
        throw new Error(`Product ${productId} not found in source location`);
      }

      // Determine which column to check/update based on type
      const sourceAvailable =
        transferType === "Good"
          ? Number(sourceStock.quantity || 0)
          : Number(sourceStock.damaged_quantity || 0);

      if (sourceAvailable < qty) {
        throw new Error(
          `Insufficient ${transferType} stock for product ${productId}`
        );
      }

      // B. Deduct from Source
      const updateSourceData: any = {};
      if (transferType === "Good") {
        updateSourceData.quantity = sourceAvailable - qty;
      } else {
        updateSourceData.damaged_quantity = sourceAvailable - qty;
      }

      await supabase
        .from("product_stocks")
        .update(updateSourceData)
        .eq("id", sourceStock.id);

      // C. Add to Destination
      const { data: destStock } = await supabase
        .from("product_stocks")
        .select("*")
        .eq("product_id", productId)
        .eq("location_id", destLocationId)
        .single();

      if (destStock) {
        const destCurrent =
          transferType === "Good"
            ? Number(destStock.quantity || 0)
            : Number(destStock.damaged_quantity || 0);

        const updateDestData: any = {};
        if (transferType === "Good") {
          updateDestData.quantity = destCurrent + qty;
        } else {
          updateDestData.damaged_quantity = destCurrent + qty;
        }

        await supabase
          .from("product_stocks")
          .update(updateDestData)
          .eq("id", destStock.id);
      } else {
        // Create new stock record if it doesn't exist
        await supabase.from("product_stocks").insert({
          product_id: productId,
          location_id: destLocationId,
          quantity: transferType === "Good" ? qty : 0,
          damaged_quantity: transferType === "Damage" ? qty : 0,
          last_updated: new Date().toISOString(),
        });
      }

      // D. Record Transfer Item
      await supabase.from("stock_transfer_items").insert({
        transfer_id: transfer.id,
        product_id: productId,
        quantity: qty,
      });

      // E. Log Transaction (Optional but good for history)
      await supabase.from("account_transactions").insert({
        transaction_type: "STOCK_TRANSFER",
        description: `Transferred ${qty} (${transferType}) of Product ${productId} from ${sourceLocationId} to ${destLocationId}`,
        amount: 0,
        transaction_date: new Date().toISOString(),
        metadata: {
          transfer_id: transfer.id,
          product_id: productId,
          type: transferType,
        },
      });
    }

    return NextResponse.json({ success: true, transfer });
  } catch (error: any) {
    console.error("Transfer Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
