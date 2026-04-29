import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const customerSchema = z.object({
  shopName: z.string().min(1, "Shop name is required"),
  ownerName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  route: z.string().optional().default("General"),
  status: z.enum(["Active", "Inactive", "Blocked"]).default("Active"),
  creditLimit: z.number().min(0).default(0),
  businessId: z.string().min(1, "Business is required"),
});

// GET: Fetch customers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repId = searchParams.get("repId");
    const businessId = searchParams.get("businessId");

    let query;

    if (repId) {
      // Rep View: Filter by assigned orders
      query = supabaseAdmin
        .from("customers")
        .select("*, businesses(name), orders!inner(sales_rep_id)")
        .eq("orders.sales_rep_id", repId)
        .order("created_at", { ascending: false });
    } else if (businessId) {
      // Business View: Filter by specific business
      query = supabaseAdmin
        .from("customers")
        .select("*, businesses(name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
    } else {
      // Admin View: Fetch all (if no filters)
      query = supabaseAdmin
        .from("customers")
        .select("*, businesses(name)")
        .order("created_at", { ascending: false });
    }

    const { data: customers, error } = await query;

    if (error) throw error;

    const mappedCustomers = customers.map((c: any) => ({
      id: c.id,
      customerId: c.id.substring(0, 8).toUpperCase(),
      shopName: c.shop_name,
      ownerName: c.owner_name || "",
      phone: c.phone,
      email: c.email || "",
      address: c.address || "",
      route: c.route || "General",
      status: c.status,
      creditLimit: c.credit_limit || 0,
      outstandingBalance: c.outstanding_balance || 0,
      lastOrderDate: c.updated_at
        ? new Date(c.updated_at).toISOString().split("T")[0]
        : "-",
      totalOrders: 0,
      businessId: c.business_id,
      businessName: c.businesses?.name || "N/A",
    }));

    return NextResponse.json(mappedCustomers);
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = customerSchema.parse(body);

    // Duplicate shop name check within the same business
    const { data: existingShops } = await supabaseAdmin
      .from("customers")
      .select("id")
      .ilike("shop_name", val.shopName.trim())
      .eq("business_id", val.businessId)
      .limit(1);

    if (existingShops && existingShops.length > 0) {
      return NextResponse.json(
        { error: "A customer with this shop name already exists in this business." },
        { status: 409 }
      );
    }

    // Duplicate phone check within the same business (only when phone is provided)
    if (val.phone) {
      const { data: existingPhones } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("phone", val.phone)
        .eq("business_id", val.businessId)
        .limit(1);

      if (existingPhones && existingPhones.length > 0) {
        return NextResponse.json(
          { error: "A customer with this phone number already exists in this business." },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({
        shop_name: val.shopName,
        owner_name: val.ownerName,
        phone: val.phone,
        email: val.email,
        address: val.address,
        route: val.route,
        status: val.status,
        credit_limit: val.creditLimit,
        business_id: val.businessId,
        outstanding_balance: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { message: "Customer created successfully", data },
      { status: 201 }
    );
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
