-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS public.product_cost_layers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  cost_price NUMERIC NOT NULL,
  original_quantity NUMERIC NOT NULL,
  remaining_quantity NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT remaining_not_negative CHECK (remaining_quantity >= 0),
  CONSTRAINT remaining_not_exceed_original CHECK (remaining_quantity <= original_quantity)
);

-- Index for fast FIFO lookups (oldest layer first per product)
CREATE INDEX IF NOT EXISTS idx_pcl_product_fifo
  ON public.product_cost_layers(product_id, created_at ASC);

-- Index for filtering only layers with remaining stock
CREATE INDEX IF NOT EXISTS idx_pcl_remaining
  ON public.product_cost_layers(product_id, remaining_quantity)
  WHERE remaining_quantity > 0;

-- Seed existing stock: create one cost layer per product using current cost price.
-- This represents stock already on hand before this feature was turned on.
INSERT INTO public.product_cost_layers
  (product_id, purchase_id, cost_price, original_quantity, remaining_quantity)
SELECT
  p.id,
  NULL,
  COALESCE(NULLIF(p.actual_cost_price, 0), p.cost_price, 0),
  GREATEST(p.stock_quantity, 0),
  GREATEST(p.stock_quantity, 0)
FROM public.products p
WHERE p.stock_quantity > 0
  AND COALESCE(NULLIF(p.actual_cost_price, 0), p.cost_price, 0) > 0;
