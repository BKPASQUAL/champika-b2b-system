-- Migration: Add Receipt Books and Receipt Book Audit tables, and update payments table

-- 1. Update payments table to store receipt numbers and receipt book references
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS receipt_number TEXT,
ADD COLUMN IF NOT EXISTS receipt_book_id UUID;

-- 2. Create receipt_books table
CREATE TABLE IF NOT EXISTS public.receipt_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_number TEXT NOT NULL,
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

-- Index for quick lookup of active receipt books by user
CREATE INDEX IF NOT EXISTS idx_receipt_books_user_status ON public.receipt_books(assigned_to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_receipt_books_book_number ON public.receipt_books(book_number);

-- 3. Create receipt_book_audits table for Admin-only auditing
CREATE TABLE IF NOT EXISTS public.receipt_book_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_book_id UUID REFERENCES public.receipt_books(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('CREATED', 'ASSIGNED', 'EDITED', 'RECEIPT_ISSUED', 'STATUS_CHANGED', 'CANCELLED', 'COMPLETED')),
  book_number TEXT,
  start_number_old BIGINT,
  start_number_new BIGINT,
  end_number_old BIGINT,
  end_number_new BIGINT,
  assigned_to_old_id UUID,
  assigned_to_old_name TEXT,
  assigned_to_new_id UUID,
  assigned_to_new_name TEXT,
  receipt_number TEXT,
  performed_by_id UUID,
  performed_by_name TEXT,
  performed_by_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit querying
CREATE INDEX IF NOT EXISTS idx_receipt_book_audits_book ON public.receipt_book_audits(receipt_book_id);
CREATE INDEX IF NOT EXISTS idx_receipt_book_audits_action ON public.receipt_book_audits(action_type);
CREATE INDEX IF NOT EXISTS idx_receipt_book_audits_date ON public.receipt_book_audits(created_at DESC);
