-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Create the home_expenses table
CREATE TABLE IF NOT EXISTS public.home_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  place TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add indexes for faster query performance (by date and category)
CREATE INDEX IF NOT EXISTS idx_home_expenses_date ON public.home_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_home_expenses_category ON public.home_expenses(category);
