-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_no TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT,
  customer_address TEXT,
  prepared_by TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')),
  items JSONB NOT NULL DEFAULT '[]',
  sub_total NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(date DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_no ON public.quotations(quotation_no);
