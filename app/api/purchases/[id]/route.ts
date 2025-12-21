import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch Purchase with Relations
    const { data: purchase, error } = await supabaseAdmin
      .from("purchases")
      .select(
        `
        *,
        supplier:suppliers ( name, contact_person, phone, email, address ),
        business:businesses ( name ),
        items:purchase_items (
          id,
          quantity,
          free_quantity,
          unit_cost,
          discount_amount,
          total_cost,
          product:products ( name, sku, unit_of_measure )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // 2. Format Data for Frontend
    const formattedData = {
      id: purchase.id,
      purchaseId: purchase.purchase_id,
      invoiceNo: purchase.invoice_no || "-",
      purchaseDate: purchase.purchase_date,
      arrivalDate: purchase.arrival_date,
      status: purchase.status,
      paymentStatus: purchase.payment_status,
      totalAmount: purchase.total_amount,
      paidAmount: purchase.paid_amount || 0,

      supplier: {
        name: purchase.supplier?.name || "Unknown",
        contactPerson: purchase.supplier?.contact_person,
        phone: purchase.supplier?.phone,
        email: purchase.supplier?.email,
        address: purchase.supplier?.address,
      },

      business: {
        name: purchase.business?.name || "N/A",
      },

      items: purchase.items.map((item: any) => ({
        id: item.id,
        productName: item.product?.name || "Unknown Product",
        sku: item.product?.sku || "-",
        quantity: item.quantity,
        freeQuantity: item.free_quantity,
        unit: item.product?.unit_of_measure || "Unit",
        unitCost: item.unit_cost,
        discount: item.discount_amount,
        totalCost: item.total_cost,
      })),
    };

    return NextResponse.json(formattedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
