import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const supplierSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(9, "Valid phone number is required"),
  address: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Pending"]).default("Active"),
  duePayment: z.number().default(0),
});

export async function GET() {
  try {
    const { data: suppliers, error } = await supabaseAdmin
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map DB fields to Frontend types
    const mappedSuppliers = suppliers.map((s) => ({
      id: s.id,
      supplierId: s.supplier_id,
      name: s.name,
      contactPerson: s.contact_person,
      email: s.email || "",
      phone: s.phone,
      address: s.address || "",
      category: s.category || "General",
      status: s.status,
      lastOrderDate: "-", // Placeholder until purchases logic is connected
      totalOrders: 0, // Placeholder
      totalOrderValue: 0, // Placeholder
      duePayment: parseFloat(s.due_payment) || 0,
    }));

    return NextResponse.json(mappedSuppliers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = supplierSchema.parse(body);

    // Generate custom Supplier ID (e.g., S-1001)
    const { count, error: countError } = await supabaseAdmin
      .from("suppliers")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    const nextId = (count || 0) + 1001;
    const supplierId = `S-${nextId}`;

    // Insert into DB
    const { data, error } = await supabaseAdmin
      .from("suppliers")
      .insert({
        supplier_id: supplierId,
        name: val.name,
        contact_person: val.contactPerson,
        email: val.email,
        phone: val.phone,
        address: val.address,
        category: val.category,
        status: val.status,
        due_payment: val.duePayment,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { message: "Supplier created", data },
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
