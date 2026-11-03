-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Per-invoice item name override: printed on the invoice instead of the product name.
-- NULL = use the normal product name. The product itself is not changed.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custom_name TEXT;
