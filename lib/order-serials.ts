import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Serial numbers for an order, grouped by order item id.
 * Returns {} if there are none (or the serials table doesn't exist yet).
 */
export async function getSerialsByOrderItem(
  orderId: string | null | undefined
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (!orderId) return result;

  const { data, error } = await supabaseAdmin
    .from("order_item_serials")
    .select("order_item_id, serial_no, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error || !data) return result;
  for (const row of data) {
    (result[row.order_item_id] ||= []).push(row.serial_no);
  }
  return result;
}
