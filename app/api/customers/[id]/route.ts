// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema for Updates (Partial)
const updateCustomerSchema = z.object({
  shopName: z.string().min(2).optional(),
  ownerName: z.string().optional(),
  phone: z.string().min(9).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  route: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Blocked"]).optional(),
  creditLimit: z.number().min(0).optional(),
});

// GET: Fetch Single Customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data: c, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!c)
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );

    // Map to Frontend Type
    const customer = {
      id: c.id,
      customerId: c.customer_id,
      shopName: c.shop_name,
      ownerName: c.owner_name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      route: c.route,
      status: c.status,
      creditLimit: c.credit_limit,
      outstandingBalance: c.outstanding_balance,
      lastOrderDate: c.last_order_date,
      totalOrders: c.total_orders,
    };

    return NextResponse.json(customer);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update Customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const val = updateCustomerSchema.parse(body);

    // Map camelCase to snake_case for DB
    const dbUpdates: any = {};
    if (val.shopName) dbUpdates.shop_name = val.shopName;
    if (val.ownerName !== undefined) dbUpdates.owner_name = val.ownerName;
    if (val.phone) dbUpdates.phone = val.phone;
    if (val.email !== undefined) dbUpdates.email = val.email;
    if (val.address !== undefined) dbUpdates.address = val.address;
    if (val.route) dbUpdates.route = val.route;
    if (val.status) dbUpdates.status = val.status;
    if (val.creditLimit !== undefined) dbUpdates.credit_limit = val.creditLimit;

    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("customers")
      .update(dbUpdates)
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

// DELETE: Remove Customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Optional: Check for dependencies (e.g., existing orders) before deleting
    // const { count } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('customer_id', id);
    // if (count && count > 0) return NextResponse.json({ error: "Cannot delete customer with existing orders" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
