import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const supplierSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  contactPerson: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Pending"]).default("Active"),
  duePayment: z.number().default(0),
  businessId: z.string().optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    // Start Query
    let query = supabaseAdmin
      .from("suppliers")
      .select(
        `
        *,
        businesses ( name )
      `
      )
      .order("created_at", { ascending: false });

    // ✅ Filter by Business ID if provided
    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data: suppliers, error } = await query;

    if (error) throw error;

    // Map to Frontend Types
    const mappedSuppliers = suppliers.map((s: any) => ({
      id: s.id,
      supplierId: s.supplier_id,
      name: s.name,
      contactPerson: s.contact_person,
      email: s.email || "",
      phone: s.phone,
      address: s.address || "",
      category: s.category || "General",
      status: s.status,
      lastOrderDate: "-",
      totalOrders: 0,
      totalOrderValue: 0,
      duePayment: parseFloat(s.due_payment) || 0,
      businessId: s.business_id,
      businessName: s.businesses?.name || null,
      bankAccountName: s.bank_account_name || null,
      bankAccountNumber: s.bank_account_number || null,
      bankName: s.bank_name || null,
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

    const { data: lastSupplier, error: countError } = await supabaseAdmin
      .from("suppliers")
      .select("supplier_id")
      .order("supplier_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (countError) throw countError;

    let nextId = 1001;
    if (lastSupplier?.supplier_id) {
      const lastNum = parseInt(lastSupplier.supplier_id.replace("S-", ""), 10);
      if (!isNaN(lastNum)) nextId = lastNum + 1;
    }
    const supplierId = `S-${nextId}`;

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
        business_id: val.businessId || null,
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
