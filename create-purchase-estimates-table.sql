-- Migration: Add Purchase Estimates table for Supplier Order Planning & Quotations
-- NOTE: Purchase estimates do NOT add to product stocks or modify inventory.

CREATE TABLE IF NOT EXISTS public.purchase_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number TEXT UNIQUE NOT NULL,
  business_id TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  reference_no TEXT,
  estimate_date DATE DEFAULT CURRENT_DATE,
  arrival_date DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  gross_total NUMERIC(12, 2) DEFAULT 0,
  line_discount_total NUMERIC(12, 2) DEFAULT 0,
  sub_total NUMERIC(12, 2) DEFAULT 0,
  extra_discount_percent NUMERIC(5, 2) DEFAULT 0,
  extra_discount_amount NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'Saved' CHECK (status IN ('Saved', 'Finalized', 'Ordered', 'Cancelled')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_estimates_business ON public.purchase_estimates(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_estimates_supplier ON public.purchase_estimates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_estimates_status ON public.purchase_estimates(status);
CREATE INDEX IF NOT EXISTS idx_purchase_estimates_date ON public.purchase_estimates(estimate_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_estimates_number ON public.purchase_estimates(estimate_number);
