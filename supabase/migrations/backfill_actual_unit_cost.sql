-- Backfill actual_unit_cost for order_items that were created before FIFO
-- tracking was enabled (those rows have actual_unit_cost = NULL).
-- Snapshots the product's current cost_price onto each historical row so that
-- future changes to the product's cost price cannot retroactively alter the
-- reported profit for already-sold items.
--
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).

UPDATE public.order_items oi
SET actual_unit_cost = p.cost_price
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.actual_unit_cost IS NULL
  AND p.cost_price IS NOT NULL
  AND p.cost_price > 0;
