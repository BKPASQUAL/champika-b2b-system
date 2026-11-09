import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompareTable } from "@/lib/web-compare";

const schema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), qty: z.coerce.number().int().min(1).max(999) })).max(200),
});

/** Public: brand comparison table for the visitor's cart (prices from the database). */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid list" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getCompareTable(body.items));
  } catch {
    return NextResponse.json({ error: "Could not compare brands. Please try again." }, { status: 500 });
  }
}
