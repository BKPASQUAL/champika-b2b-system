// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const customerSchema = z.object({
  shopName: z.string().min(2, "Shop name is required"),
  ownerName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  route: z.string().min(1, "Route is required"),
  status: z.enum(["Active", "Inactive", "Blocked"]).default("Active"),
  creditLimit: z.number().min(0).default(0),
  businessId: z.string().min(1, "Business is required"),
});

// PATCH: Update a customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = customerSchema.parse(body);

    // Duplicate shop name check (excluding this customer)
    const { data: existingShops } = await supabaseAdmin
      .from("customers")
      .select("id")
      .ilike("shop_name", val.shopName.trim())
      .eq("business_id", val.businessId)
      .neq("id", id)
      .limit(1);

    if (existingShops && existingShops.length > 0) {
      return NextResponse.json(
        { error: "A customer with this shop name already exists in this business." },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        shop_name: val.shopName,
        owner_name: val.ownerName,
        phone: val.phone,
        email: val.email,
        address: val.address,
        route: val.route,
        status: val.status,
        credit_limit: val.creditLimit,
        business_id: val.businessId,
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Customer updated successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
