-- Serial number tracking (e.g. Sisil Ceiling Fan).
-- Run once in the Supabase SQL editor BEFORE deploying the code.

BEGIN;

-- 1. Switch on the product: "this item needs a serial number for every unit sold"
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_serial boolean NOT NULL DEFAULT false;

-- 2. One row per serial number scanned / typed while checking an order
CREATE TABLE IF NOT EXISTS public.order_item_serials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_no text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- The same serial can't be sold twice for the same product
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_item_serials_product_serial
  ON public.order_item_serials (product_id, upper(trim(serial_no)));

CREATE INDEX IF NOT EXISTS idx_order_item_serials_order
  ON public.order_item_serials (order_id);

CREATE INDEX IF NOT EXISTS idx_order_item_serials_serial
  ON public.order_item_serials (upper(trim(serial_no)));

COMMIT;
