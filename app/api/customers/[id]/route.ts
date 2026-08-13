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
  route: z.string().optional().default("General"),
  status: z.enum(["Active", "Inactive", "Blocked"]).default("Active"),
  creditLimit: z.number().min(0).default(0),
  businessId: z.string().min(1, "Business is required"),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationNumber: z.string().optional(),
});

// GET: Fetch single customer details with full financial history (invoices, payments, returns, cheques)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch Customer Profile
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("*, businesses(name)")
      .eq("id", id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // 2. Fetch Payments for this customer directly
    const { data: directPayments = [] } = await supabaseAdmin
      .from("payments")
      .select("*, invoices(invoice_no)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    const paymentInvoiceIds = Array.from(
      new Set((directPayments || []).map((p: any) => p.invoice_id).filter(Boolean))
    );

    // 3. Fetch Orders for this customer directly
    const { data: customerOrders = [] } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_id", id);

    const customerOrderIds = (customerOrders || []).map((o: any) => o.id).filter(Boolean);

    // 4. Fetch Invoices directly for this customer
    const { data: directInvoices = [] } = await supabaseAdmin
      .from("invoices")
      .select(`
        id,
        invoice_no,
        manual_invoice_no,
        order_id,
        customer_id,
        total_amount,
        paid_amount,
        due_amount,
        status,
        due_date,
        created_at,
        orders (
          id,
          order_date,
          status,
          notes
        )
      `)
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    // 5. Fetch additional invoices linked via payments or orders
    let additionalInvoices: any[] = [];
    const missingInvoiceIds = paymentInvoiceIds.filter(
      (pId) => !(directInvoices || []).some((inv: any) => inv.id === pId)
    );

    if (missingInvoiceIds.length > 0) {
      const { data: payInvoices } = await supabaseAdmin
        .from("invoices")
        .select(`
          id,
          invoice_no,
          manual_invoice_no,
          order_id,
          customer_id,
          total_amount,
          paid_amount,
          due_amount,
          status,
          due_date,
          created_at,
          orders (
            id,
            order_date,
            status,
            notes
          )
        `)
        .in("id", missingInvoiceIds);
      if (payInvoices) additionalInvoices.push(...payInvoices);
    }

    if (customerOrderIds.length > 0) {
      const { data: orderInvoices } = await supabaseAdmin
        .from("invoices")
        .select(`
          id,
          invoice_no,
          manual_invoice_no,
          order_id,
          customer_id,
          total_amount,
          paid_amount,
          due_amount,
          status,
          due_date,
          created_at,
          orders (
            id,
            order_date,
            status,
            notes
          )
        `)
        .in("order_id", customerOrderIds);
      if (orderInvoices) additionalInvoices.push(...orderInvoices);
    }

    // Deduplicate invoices by ID
    const invoiceMap = new Map();
    (directInvoices || []).forEach((inv: any) => invoiceMap.set(inv.id, inv));
    (additionalInvoices || []).forEach((inv: any) => invoiceMap.set(inv.id, inv));
    const invoiceList = Array.from(invoiceMap.values());

    const invoiceIds = invoiceList.map((inv: any) => inv.id);
    const invoiceNoMap: Record<string, string> = {};
    invoiceList.forEach((inv: any) => {
      if (inv.id) invoiceNoMap[inv.id] = inv.invoice_no;
    });

    const mappedInvoices = invoiceList.map((inv: any) => {
      const order = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
      const totalAmt = Number(inv.total_amount) || 0;
      const paidAmt = Number(inv.paid_amount) || 0;
      const dueAmt = inv.due_amount != null ? Number(inv.due_amount) : Math.max(0, totalAmt - paidAmt);
      const invDate = order?.order_date || inv.created_at;

      const invStatus = inv.status || "Unpaid";
      const isInvCancelled = invStatus.toLowerCase().includes("cancel");
      const ordStatus = isInvCancelled ? "Cancelled" : (order?.status || invStatus || "Delivered");

      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        manualInvoiceNo: inv.manual_invoice_no,
        orderId: inv.order_id,
        date: invDate,
        totalAmount: totalAmt,
        paidAmount: paidAmt,
        dueAmount: dueAmt,
        status: invStatus,
        orderStatus: ordStatus,
        dueDate: inv.due_date,
        notes: order?.notes || "",
        createdAt: inv.created_at,
      };
    });

    // 6. Fetch Payments for this customer (including payments linked to any of the customer's invoices)
    let payments: any[] = directPayments || [];
    if (invoiceIds.length > 0) {
      const { data: payData } = await supabaseAdmin
        .from("payments")
        .select("*, invoices(invoice_no)")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: false });
      if (payData) {
        payments = [...(directPayments || []), ...(payData || [])];
      }
    }

    // Deduplicate payments by ID
    const paymentMap = new Map();
    (payments || []).forEach((p: any) => paymentMap.set(p.id, p));
    const uniquePayments = Array.from(paymentMap.values());

    // 7. Fetch Inventory Returns for this customer
    const { data: returnsData = [] } = await supabaseAdmin
      .from("inventory_returns")
      .select("*, products(name, sku)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    const returnsList = returnsData || [];

    // 8. Extract & Categorize Cheques
    const chequesList = uniquePayments
      .filter((p) => p.method === "cheque" || p.cheque_no)
      .map((p) => {
        const invNo = p.invoices?.invoice_no || (p.invoice_id ? invoiceNoMap[p.invoice_id] : "N/A");
        const status = p.cheque_status || "Pending";
        return {
          id: p.id,
          chequeNo: p.cheque_no || "N/A",
          chequeDate: p.cheque_date || p.created_at,
          amount: Number(p.amount) || 0,
          status: status,
          invoiceNo: invNo,
          invoiceId: p.invoice_id,
          notes: p.notes || "",
          createdAt: p.created_at,
        };
      });

    // Summaries calculation
    const totalInvoiced = mappedInvoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
    const totalPaid = mappedInvoices.reduce((sum: number, inv: any) => sum + inv.paidAmount, 0);
    const totalDue = mappedInvoices.reduce((sum: number, inv: any) => sum + inv.dueAmount, 0);

    const pendingCheques = chequesList.filter(
      (c) => c.status.toLowerCase() === "pending" || c.status.toLowerCase() === "deposited"
    );
    const clearedCheques = chequesList.filter(
      (c) => c.status.toLowerCase() === "passed" || c.status.toLowerCase() === "cleared"
    );
    const returnedCheques = chequesList.filter(
      (c) => c.status.toLowerCase() === "returned" || c.status.toLowerCase() === "bounced"
    );

    const pendingChequesAmount = pendingCheques.reduce((sum, c) => sum + c.amount, 0);
    const clearedChequesAmount = clearedCheques.reduce((sum, c) => sum + c.amount, 0);
    const returnedChequesAmount = returnedCheques.reduce((sum, c) => sum + c.amount, 0);

    const goodReturnsCount = returnsList.filter((r: any) => r.return_type === "Good").length;
    const damageReturnsCount = returnsList.filter((r: any) => r.return_type === "Damage").length;

    const formattedCustomer = {
      id: customer.id,
      customerId: customer.customer_id || customer.id.substring(0, 8),
      shopName: customer.shop_name,
      ownerName: customer.owner_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      route: customer.route || "General",
      status: customer.status || "Active",
      creditLimit: Number(customer.credit_limit) || 0,
      outstandingBalance: Number(customer.outstanding_balance) || 0,
      businessId: customer.business_id,
      businessName: customer.businesses?.name || "General",
      latitude: customer.latitude,
      longitude: customer.longitude,
      locationNumber: customer.location_number,
      createdAt: customer.created_at,
    };

    return NextResponse.json({
      customer: formattedCustomer,
      summary: {
        totalInvoicesCount: mappedInvoices.length,
        totalInvoiced,
        totalPaid,
        totalDue,
        outstandingBalance: formattedCustomer.outstandingBalance,
        creditLimit: formattedCustomer.creditLimit,
        creditAvailable: Math.max(0, formattedCustomer.creditLimit - formattedCustomer.outstandingBalance),
        cheques: {
          totalCount: chequesList.length,
          pendingCount: pendingCheques.length,
          pendingAmount: pendingChequesAmount,
          clearedCount: clearedCheques.length,
          clearedAmount: clearedChequesAmount,
          returnedCount: returnedCheques.length,
          returnedAmount: returnedChequesAmount,
        },
        returns: {
          totalCount: returnsList.length,
          goodCount: goodReturnsCount,
          damageCount: damageReturnsCount,
        },
      },
      invoices: mappedInvoices,
      payments: uniquePayments.map((p: any) => ({
        id: p.id,
        date: p.created_at || p.payment_date,
        amount: Number(p.amount) || 0,
        method: p.method,
        chequeNo: p.cheque_no,
        chequeDate: p.cheque_date,
        chequeStatus: p.cheque_status,
        invoiceNo: p.invoices?.invoice_no || (p.invoice_id ? invoiceNoMap[p.invoice_id] : "N/A"),
        notes: p.notes,
      })),
      cheques: chequesList,
      returns: returnsList.map((r: any) => ({
        id: r.id,
        returnNumber: r.return_number || `RET-${r.id.substring(0, 6)}`,
        date: r.created_at,
        productName: r.products?.name || "Unknown Product",
        sku: r.products?.sku || "",
        quantity: r.quantity,
        returnType: r.return_type,
        reason: r.reason || "No reason specified",
      })),
    });
  } catch (error: any) {
    console.error("GET Customer Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = customerSchema.parse(body);

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
        latitude: val.latitude,
        longitude: val.longitude,
        location_number: val.locationNumber || null,
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

// DELETE: Remove customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin.from("customers").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
