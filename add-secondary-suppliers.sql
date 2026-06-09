-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Create the product_suppliers join table
CREATE TABLE IF NOT EXISTS public.product_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  cost_price NUMERIC, -- Optional override cost price for this specific supplier
  commission_value NUMERIC, -- Optional override commission rate (percentage) for this specific supplier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

-- 2. Add an index for quick lookups on product_id
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON public.product_suppliers(product_id);
