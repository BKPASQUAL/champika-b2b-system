import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: estimate, error } = await supabaseAdmin
      .from("purchase_estimates")
      .select(
        `
        *,
        suppliers ( id, name, contact_person, phone, email, address )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
      }
      throw error;
    }

    const formatted = {
      id: estimate.id,
      estimateNumber: estimate.estimate_number,
      businessId: estimate.business_id,
      supplierId: estimate.supplier_id,
      supplierName: estimate.suppliers?.name || estimate.supplier_name || "Unknown Supplier",
      supplier: estimate.suppliers || {
        name: estimate.supplier_name || "Unknown",
      },
      referenceNo: estimate.reference_no || "",
      estimateDate: estimate.estimate_date,
      arrivalDate: estimate.arrival_date || "",
      items: estimate.items || [],
      grossTotal: Number(estimate.gross_total) || 0,
      lineDiscountTotal: Number(estimate.line_discount_total) || 0,
      subTotal: Number(estimate.sub_total) || 0,
      extraDiscountPercent: Number(estimate.extra_discount_percent) || 0,
      extraDiscountAmount: Number(estimate.extra_discount_amount) || 0,
      totalAmount: Number(estimate.total_amount) || 0,
      status: estimate.status || "Saved",
      notes: estimate.notes || "",
      createdBy: estimate.created_by || "",
      createdAt: estimate.created_at,
      updatedAt: estimate.updated_at,
    };

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Error fetching single purchase estimate:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.reference_no !== undefined) updateData.reference_no = body.reference_no;
    if (body.estimate_date !== undefined) updateData.estimate_date = body.estimate_date;
    if (body.arrival_date !== undefined) updateData.arrival_date = body.arrival_date;
    if (body.items !== undefined) {
      updateData.items = body.items;
      updateData.gross_total = body.gross_total;
      updateData.line_discount_total = body.line_discount_total;
      updateData.sub_total = body.sub_total;
      updateData.extra_discount_percent = body.extra_discount_percent;
      updateData.extra_discount_amount = body.extra_discount_amount;
      updateData.total_amount = body.total_amount;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("purchase_estimates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Estimate updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating purchase estimate:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("purchase_estimates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Estimate deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting purchase estimate:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
