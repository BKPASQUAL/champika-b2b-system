import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const supplier = request.nextUrl.searchParams.get("supplier") || "XX";
  const prefix = supplier.substring(0, 2).toUpperCase();

  const { data: existingSkus } = await supabaseAdmin
    .from("products")
    .select("sku")
    .ilike("sku", `${prefix}-%`);

  let maxNum = 0;
  if (existingSkus && existingSkus.length > 0) {
    existingSkus.forEach((item) => {
      if (item.sku) {
        const parts = item.sku.split("-");
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
  }

  const nextSku = `${prefix}-${(maxNum + 1).toString().padStart(4, "0")}`;
  return NextResponse.json({ sku: nextSku });
}
