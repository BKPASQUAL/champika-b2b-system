import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_PO_PREFIXES } from "@/app/config/business-constants";

// Validation Schema for an item in a purchase estimate
const estimateItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  sku: z.string().optional().default(""),
  productName: z.string(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  freeQuantity: z.number().default(0),
  unit: z.string().optional().default("Pcs"),
  mrp: z.number().optional().default(0),
  sellingPrice: z.number().optional().default(0),
  unitPrice: z.number().min(0, "Cost Price must be non-negative"), // Quoted / Bill Price
  discountPercent: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  finalPrice: z.number().optional().default(0),
  total: z.number().min(0), // Line total
});

const estimateSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  business_id: z.string().min(1, "Business is required"),
  supplier_name: z.string().optional(),
  reference_no: z.string().optional().default(""),
  estimate_date: z.string(),
  arrival_date: z.string().optional().or(z.literal("")),
  items: z.array(estimateItemSchema).min(1, "At least one item is required"),
  gross_total: z.number().optional().default(0),
  line_discount_total: z.number().optional().default(0),
  sub_total: z.number().optional().default(0),
  extra_discount_percent: z.number().optional().default(0),
  extra_discount_amount: z.number().optional().default(0),
  total_amount: z.number().min(0),
  status: z.enum(["Saved", "Finalized", "Ordered", "Cancelled"]).optional().default("Saved"),
  notes: z.string().optional().default(""),
  created_by: z.string().optional().default(""),
});

// --- GET: Fetch all Purchase Estimates (Filtered by Business) ---
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("purchase_estimates")
      .select(
        `
        *,
        suppliers ( id, name, contact_person, phone, email )
      `
      )
      .order("created_at", { ascending: false });

    if (businessId) {
      query = query.eq("business_id", businessId);
    }
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      // Table may not exist yet in Supabase
      if (error.code === "PGRST205") {
        return NextResponse.json(
          {
            error: "Table purchase_estimates does not exist yet. Please run create-purchase-estimates-table.sql in Supabase SQL editor.",
            code: "TABLE_NOT_FOUND",
            data: [],
          },
          { status: 200 }
        );
      }
      throw error;
    }

    const estimates = (data || []).map((e: any) => ({
      id: e.id,
      estimateNumber: e.estimate_number,
      businessId: e.business_id,
      supplierId: e.supplier_id,
      supplierName: e.suppliers?.name || e.supplier_name || "Unknown Supplier",
      supplierPhone: e.suppliers?.phone || "",
      supplierEmail: e.suppliers?.email || "",
      referenceNo: e.reference_no || "",
      estimateDate: e.estimate_date,
      arrivalDate: e.arrival_date || "",
      items: e.items || [],
      itemsCount: Array.isArray(e.items) ? e.items.length : 0,
      totalQuantity: Array.isArray(e.items)
        ? e.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0) + (Number(it.freeQuantity) || 0), 0)
        : 0,
      grossTotal: Number(e.gross_total) || 0,
      lineDiscountTotal: Number(e.line_discount_total) || 0,
      subTotal: Number(e.sub_total) || 0,
      extraDiscountPercent: Number(e.extra_discount_percent) || 0,
      extraDiscountAmount: Number(e.extra_discount_amount) || 0,
      totalAmount: Number(e.total_amount) || 0,
      status: e.status || "Saved",
      notes: e.notes || "",
      createdBy: e.created_by || "",
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));

    return NextResponse.json(estimates);
  } catch (error: any) {
    console.error("Error fetching purchase estimates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Create New Purchase Estimate ---
// NOTE: This purely calculates prices & saves quotation data. NO STOCK IS ADDED!
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = estimateSchema.parse(body);

    // Fetch supplier name if not provided
    let supplierName = val.supplier_name;
    if (!supplierName) {
      const { data: sup } = await supabaseAdmin
        .from("suppliers")
        .select("name")
        .eq("id", val.supplier_id)
        .maybeSingle();
      supplierName = sup?.name || "Supplier";
    }

    // 1. Generate sequential Estimate Number
    const businessPrefix = BUSINESS_PO_PREFIXES[val.business_id] || "X";
    const { data: lastEstimate } = await supabaseAdmin
      .from("purchase_estimates")
      .select("estimate_number")
      .eq("business_id", val.business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1001;
    if (lastEstimate?.estimate_number) {
      const match = lastEstimate.estimate_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const estimateNumber = `${businessPrefix}EST-${nextNumber}`;

    // 2. Insert into purchase_estimates table
    // Pure quotation/estimate save - NO stock increment, NO inventory movements
    const { data: estimate, error: insertError } = await supabaseAdmin
      .from("purchase_estimates")
      .insert({
        estimate_number: estimateNumber,
        business_id: val.business_id,
        supplier_id: val.supplier_id,
        supplier_name: supplierName,
        reference_no: val.reference_no,
        estimate_date: val.estimate_date,
        arrival_date: val.arrival_date || null,
        items: val.items,
        gross_total: val.gross_total,
        line_discount_total: val.line_discount_total,
        sub_total: val.sub_total,
        extra_discount_percent: val.extra_discount_percent,
        extra_discount_amount: val.extra_discount_amount,
        total_amount: val.total_amount,
        status: val.status,
        notes: val.notes,
        created_by: val.created_by,
      })
      .select(`
        *,
        suppliers ( id, name, contact_person, phone, email )
      `)
      .single();

    if (insertError) {
      if (insertError.code === "PGRST205") {
        return NextResponse.json(
          {
            error: "Table purchase_estimates does not exist yet. Please run create-purchase-estimates-table.sql in Supabase SQL editor.",
            code: "TABLE_NOT_FOUND",
          },
          { status: 400 }
        );
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      data: estimate,
      message: `Purchase Estimate ${estimateNumber} created successfully! (No stock affected)`,
    });
  } catch (error: any) {
    console.error("Error creating purchase estimate:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create purchase estimate" },
      { status: 500 }
    );
  }
}
