-- Supplier Payment Vouchers
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- A voucher is created when supplier cheques are handed over to someone.
-- It records who took the cheques and snapshots the invoices + cheques it covers.

CREATE TABLE IF NOT EXISTS public.supplier_payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT NOT NULL UNIQUE,
  business_id TEXT,
  supplier_id UUID,
  supplier_name TEXT,
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receiver_name TEXT,                          -- optional: blank = written by hand on the printout
  receiver_nic TEXT,
  receiver_designation TEXT,
  receiver_phone TEXT,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_ids UUID[] NOT NULL DEFAULT '{}',
  cheques JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{cheque_number, cheque_date, account_name, amount}]
  invoices JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{purchase_id, invoice_no, invoice_date, invoice_total, paid_amount, cheque_number}]
  notes TEXT,
  prepared_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spv_business ON public.supplier_payment_vouchers(business_id);
CREATE INDEX IF NOT EXISTS idx_spv_supplier ON public.supplier_payment_vouchers(supplier_id);

-- If the table was already created with receiver_name required, make it optional
ALTER TABLE public.supplier_payment_vouchers ALTER COLUMN receiver_name DROP NOT NULL;

-- Link each supplier payment to the voucher it was handed over on
ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.supplier_payment_vouchers(id) ON DELETE SET NULL;

-- Make the API see the new table straight away
NOTIFY pgrst, 'reload schema';
