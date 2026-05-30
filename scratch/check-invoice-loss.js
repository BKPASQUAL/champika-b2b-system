const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2].trim();
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseServiceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  console.log("Checking invoice/order details for manual_invoice_no 'CHD-0095' or invoice_no...");
  
  // Find invoice
  const { data: invoices, error: invError } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, manual_invoice_no, total_amount, due_amount, status,
      order:orders!inner (
        id, order_id, status, order_date, customer_id, customer:customers(shop_name),
        items:order_items (
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
          product:products (id, name, supplier_name)
        )
      )
    `)
    .or(`manual_invoice_no.eq.CHD-0095,invoice_no.eq.CHD-0095`);

  if (invError) {
    console.error("Error fetching invoice:", invError);
    return;
  }

  console.log(`Found ${invoices?.length || 0} matching invoices:`);
  
  invoices.forEach(inv => {
    console.log("Invoice Info:", {
      id: inv.id,
      invoice_no: inv.invoice_no,
      manual_invoice_no: inv.manual_invoice_no,
      total_amount: inv.total_amount,
      due_amount: inv.due_amount,
      status: inv.status
    });

    const order = inv.order;
    if (order) {
      console.log("Order Date:", order.order_date);
      console.log("Customer:", order.customer?.shop_name);
      console.log("Items:");
      let totalCost = 0;
      let totalRevenue = 0;
      order.items.forEach(item => {
        const qty = Number(item.quantity) || 0;
        const freeQty = Number(item.free_quantity) || 0;
        const revenue = Number(item.total_price) || 0;
        const cost = qty * (Number(item.actual_unit_cost) || 0);
        const freeCost = freeQty * (Number(item.actual_unit_cost) || 0);
        totalCost += cost;
        totalRevenue += revenue;
        console.log({
          productId: item.product?.id,
          productName: item.product?.name,
          supplierName: item.product?.supplier_name,
          qty,
          freeQty,
          unitPrice: item.unit_price,
          actualUnitCost: item.actual_unit_cost,
          totalPrice: item.total_price,
          claimStatus: item.claim_status,
          itemCost: cost,
          itemFreeCost: freeCost,
          itemRevenue: revenue
        });
      });
      console.log(`Summary - Calculated Revenue: ${totalRevenue}, Paid Qty Cost: ${totalCost}, Paid Qty Profit: ${totalRevenue - totalCost}`);
    }
  });
}

main();
