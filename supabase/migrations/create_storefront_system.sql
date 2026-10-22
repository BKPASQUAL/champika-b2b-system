-- ============================================================================
-- SAFE ADDITIVE MIGRATION: BK WIRING KADE STOREFRONT SYSTEM
-- Guaranteed 100% Non-Destructive: Does not drop, delete, or alter existing data.
-- ============================================================================

-- 1. Storefront Product Settings (New Table)
-- Controls which warehouse items are published online, their custom online prices, and stock buffers.
CREATE TABLE IF NOT EXISTS public.storefront_products (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              UUID REFERENCES public.products(id) ON DELETE CASCADE UNIQUE,
  is_published            BOOLEAN DEFAULT false,
  is_featured             BOOLEAN DEFAULT false,
  online_title            TEXT,
  online_description      TEXT,
  category_slug           TEXT,
  online_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_mode              TEXT DEFAULT 'buffer', -- 'buffer' | 'backorder' | 'fixed_cap'
  stock_buffer            INTEGER DEFAULT 5,     -- Reserved for walk-in / B2B sales
  max_order_quantity      INTEGER DEFAULT 50,
  allow_backorder         BOOLEAN DEFAULT true,
  lead_time_days          INTEGER DEFAULT 2,
  display_order           INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Storefront Orders (New Table)
-- Stores customer orders with full order-to-delivery lifecycle tracking
CREATE TABLE IF NOT EXISTS public.storefront_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no                TEXT UNIQUE NOT NULL,  -- e.g. STO-0001
  user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name           TEXT NOT NULL,
  customer_phone          TEXT NOT NULL,
  customer_email          TEXT NOT NULL,
  delivery_address        TEXT NOT NULL,
  items                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  sub_total               NUMERIC(12,2) DEFAULT 0,
  discount_amount         NUMERIC(12,2) DEFAULT 0,
  delivery_fee            NUMERIC(12,2) DEFAULT 0,
  grand_total             NUMERIC(12,2) NOT NULL,
  payment_method          TEXT DEFAULT 'COD',    -- 'COD' | 'BANK_TRANSFER'
  payment_status          TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Verified', 'Paid', 'Failed')),
  bank_slip_url           TEXT,
  
  -- Order-to-Delivery Process Management
  order_status            TEXT DEFAULT 'Pending' CHECK (order_status IN ('Pending', 'Confirmed', 'Processing', 'Dispatched', 'Delivered', 'Cancelled')),
  invoice_id              UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Tracking details for customer
  courier_or_lorry        TEXT,                  -- e.g. "Delivery Lorry 02", "Pronto Courier"
  tracking_number         TEXT,                  -- Waybill or delivery reference
  estimated_delivery      DATE,
  dispatched_at           TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  
  -- Step-by-step history logs for transparency
  status_history          JSONB DEFAULT '[]'::jsonb, -- [{ status: 'Pending', time: '...', note: '...' }]
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customer Messages & Inquiries (New Table)
CREATE TABLE IF NOT EXISTS public.storefront_inquiries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name           TEXT NOT NULL,
  customer_phone          TEXT NOT NULL,
  customer_email          TEXT,
  subject                 TEXT,
  message                 TEXT NOT NULL,
  product_id              UUID REFERENCES public.products(id) ON DELETE SET NULL,
  inquiry_type            TEXT DEFAULT 'General', -- 'General' | 'Price_Quote' | 'Out_Of_Stock_Request'
  status                  TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Resolved')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Extend Quotations table safely (Adds optional columns only)
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'B2B',
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS project_title TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS quotation_token TEXT UNIQUE;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_storefront_prod_pub ON public.storefront_products(is_published);
CREATE INDEX IF NOT EXISTS idx_storefront_orders_st ON public.storefront_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_storefront_orders_usr ON public.storefront_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_storefront_inq_st ON public.storefront_inquiries(status);
