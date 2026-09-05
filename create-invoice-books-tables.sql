-- Migration: Add Invoice Books and Invoice Book Audits tables

CREATE TABLE IF NOT EXISTS public.invoice_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_number TEXT NOT NULL,
  prefix TEXT DEFAULT 'CHD',
  start_number BIGINT NOT NULL,
  end_number BIGINT NOT NULL,
  current_number BIGINT NOT NULL,
  assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to_user_name TEXT,
  business_id TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoice_books_user_status ON public.invoice_books(assigned_to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_books_book_number ON public.invoice_books(book_number);

CREATE TABLE IF NOT EXISTS public.invoice_book_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_book_id UUID REFERENCES public.invoice_books(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('CREATED', 'ASSIGNED', 'EDITED', 'INVOICE_ISSUED', 'STATUS_CHANGED', 'CANCELLED', 'COMPLETED')),
  book_number TEXT,
  start_number_old BIGINT,
  start_number_new BIGINT,
  end_number_old BIGINT,
  end_number_new BIGINT,
  assigned_to_old_id UUID,
  assigned_to_old_name TEXT,
  assigned_to_new_id UUID,
  assigned_to_new_name TEXT,
  invoice_number TEXT,
  performed_by_id UUID,
  performed_by_name TEXT,
  performed_by_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_book_audits_book ON public.invoice_book_audits(invoice_book_id);
CREATE INDEX IF NOT EXISTS idx_invoice_book_audits_date ON public.invoice_book_audits(created_at DESC);
