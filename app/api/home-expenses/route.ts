import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("home_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    // If table doesn't exist yet, we fail gracefully with an empty list rather than crashing, 
    // but we log a warning so the developer knows they need to run the migration.
    if (error) {
      console.warn("⚠️ Warning fetching home_expenses. Has the table been created?", error.message);
      return NextResponse.json([]);
    }

    const mapped = data.map((e: any) => ({
      id: e.id,
      category: e.category,
      amount: e.amount,
      place: e.place || "",
      expenseDate: e.expense_date,
      description: e.description || "",
      createdAt: e.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.category || body.amount === undefined || body.amount === null) {
      return NextResponse.json({ error: "Category and amount are required." }, { status: 400 });
    }

    const numericAmount = parseFloat(body.amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return NextResponse.json({ error: "Amount must be a non-negative number." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("home_expenses")
      .insert({
        category: body.category,
        amount: numericAmount,
        place: body.place || null,
        expense_date: body.expenseDate || new Date().toISOString().split("T")[0],
        description: body.description || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { message: "Home expense added successfully.", data },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
