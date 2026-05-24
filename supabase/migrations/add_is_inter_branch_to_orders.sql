-- Add is_inter_branch flag to orders.
-- Inter-branch auto-bills should NEVER affect product stock.
-- Any Postgres trigger that reduces stock on order_items INSERT must check this flag.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_inter_branch boolean NOT NULL DEFAULT false;

-- If you have a Postgres trigger on order_items that reduces stock, add this guard:
--
--   CREATE OR REPLACE FUNCTION your_stock_deduct_fn() RETURNS trigger AS $$
--   DECLARE
--     v_is_inter_branch boolean;
--   BEGIN
--     SELECT is_inter_branch INTO v_is_inter_branch
--       FROM public.orders WHERE id = NEW.order_id;
--     IF v_is_inter_branch THEN
--       RETURN NEW;   -- skip stock deduction for inter-branch bills
--     END IF;
--     -- ... existing stock deduction logic ...
--     RETURN NEW;
--   END;
--   $$ LANGUAGE plpgsql;
