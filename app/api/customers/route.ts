// app/api/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const customerSchema = z.object({
  shopName: z.string().min(2, "Shop name is required"),
  ownerName: z.string().optional(),
  phone: z.string().min(9, "Valid phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  route: z.string().min(1, "Route is required"),
  status: z.enum(["Active", "Inactive", "Blocked"]).default("Active"),
  creditLimit: z.number().min(0).default(0),
});

// GET: Fetch all customers
export async function GET() {
  try {
    const { data: customers, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map DB fields (snake_case) to Frontend types (camelCase)
    const mappedCustomers = customers.map((c) => ({
      id: c.id,
      customerId: c.id.substring(0, 8).toUpperCase(), // Generate a short ID from UUID since 'customer_id' column is missing
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
        : "-", // Fallback to updated_at
      totalOrders: 0, // Placeholder as 'total_orders' might not exist in schema yet
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

    // Removed 'customer_id' generation to fix the error.
    // We only insert fields that exist in your provided schema.
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
