-- =====================================================================
-- BK Wiring Website (bkwiringbadukade.lk) — online shop tables
-- Same database as the B2B system. The website is treated as its own
-- business; every web item links to a main `products` row so stock
-- deduction and FIFO cost keep working through the existing logic.
-- ONE FILE for all website database changes. Run the whole file in the
-- Supabase SQL Editor. Safe to re-run on any database (new, half done, or
-- fully done): tables, columns, indexes and policies are only added when
-- missing, and existing data is never deleted.
-- =====================================================================

-- 1. Website business ------------------------------------------------
INSERT INTO businesses (id, name, description)
VALUES ('e7825b22-fa7a-4a82-bbe9-f0ad89386e2f', 'BK Wiring Website', 'Online shop - bkwiringbadukade.lk')
ON CONFLICT (id) DO NOTHING;

-- 2. Website categories ----------------------------------------------
CREATE TABLE IF NOT EXISTS web_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES web_categories(id) ON DELETE SET NULL,
  image_url   TEXT,
  description TEXT,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_categories: add any missing columns.
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS slug        TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_categories' AND column_name='parent_id') THEN ALTER TABLE web_categories ADD COLUMN parent_id UUID REFERENCES web_categories(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS image_url   TEXT;
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS sort_order  INT DEFAULT 0;
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- 2a. Product families (e.g. "Single solid Cables"), optionally under a sub category
CREATE TABLE IF NOT EXISTS web_product_families (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  web_category_id UUID REFERENCES web_categories(id) ON DELETE SET NULL,
  description     TEXT,
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_product_families: add any missing columns.
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS name            TEXT;
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS slug            TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_product_families' AND column_name='web_category_id') THEN ALTER TABLE web_product_families ADD COLUMN web_category_id UUID REFERENCES web_categories(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS sort_order      INT DEFAULT 0;
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT TRUE;
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- 2b. Brands and sub brands (sub brand = brand with a parent, e.g. ACL → Fire Guard)
CREATE TABLE IF NOT EXISTS web_brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES web_brands(id) ON DELETE CASCADE,
  logo_url    TEXT,
  description TEXT,
  sort_order  INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT TRUE,   -- show in "Shop by Brand" on the home page
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_brands: add any missing columns.
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS slug        TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_brands' AND column_name='parent_id') THEN ALTER TABLE web_brands ADD COLUMN parent_id UUID REFERENCES web_brands(id) ON DELETE CASCADE; END IF; END $$;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS logo_url    TEXT;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS sort_order  INT DEFAULT 0;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT TRUE;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_brands ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();
-- Same name allowed under different parents (Orange → Orange), not twice under one parent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_web_brands_parent_name
  ON web_brands (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- 2c. Suppliers (internal — not shown to customers)
CREATE TABLE IF NOT EXISTS web_suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_suppliers: add any missing columns.
ALTER TABLE web_suppliers ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE web_suppliers ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE web_suppliers ADD COLUMN IF NOT EXISTS notes      TEXT;
ALTER TABLE web_suppliers ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT TRUE;
ALTER TABLE web_suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS uq_web_suppliers_name ON web_suppliers (lower(name));

-- 3. Website products = one product PAGE (name, text, specs, images).
--    Price / stock link lives in web_product_variants (exactly one row per product).
CREATE TABLE IF NOT EXISTS web_products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  short_description   TEXT,
  description         TEXT,
  specs               JSONB DEFAULT '[]',   -- [{ "label": "Conductor Area", "value": "1mm²" }]
  web_category_id     UUID REFERENCES web_categories(id) ON DELETE SET NULL,  -- main category
  web_sub_category_id UUID REFERENCES web_categories(id) ON DELETE SET NULL,  -- sub category
  web_family_id       UUID REFERENCES web_product_families(id) ON DELETE SET NULL,
  web_brand_id        UUID REFERENCES web_brands(id) ON DELETE SET NULL,
  web_sub_brand_id    UUID REFERENCES web_brands(id) ON DELETE SET NULL,
  web_supplier_id     UUID REFERENCES web_suppliers(id) ON DELETE SET NULL,
  extra_category_ids  UUID[] DEFAULT '{}',  -- also listed in these categories
  tags                TEXT[] DEFAULT '{}',
  brand_text          TEXT,
  images              TEXT[] DEFAULT '{}',
  is_published        BOOLEAN DEFAULT FALSE,
  is_featured         BOOLEAN DEFAULT FALSE,
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_products: add any missing columns.
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS slug                TEXT;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS name                TEXT;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS short_description   TEXT;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS description         TEXT;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS specs               JSONB DEFAULT '[]';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_products' AND column_name='web_category_id') THEN ALTER TABLE web_products ADD COLUMN web_category_id UUID REFERENCES web_categories(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_products' AND column_name='web_sub_category_id') THEN ALTER TABLE web_products ADD COLUMN web_sub_category_id UUID REFERENCES web_categories(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_products' AND column_name='web_family_id') THEN ALTER TABLE web_products ADD COLUMN web_family_id UUID REFERENCES web_product_families(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_products' AND column_name='web_brand_id') THEN ALTER TABLE web_products ADD COLUMN web_brand_id UUID REFERENCES web_brands(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_products' AND column_name='web_sub_brand_id') THEN ALTER TABLE web_products ADD COLUMN web_sub_brand_id UUID REFERENCES web_brands(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_products' AND column_name='web_supplier_id') THEN ALTER TABLE web_products ADD COLUMN web_supplier_id UUID REFERENCES web_suppliers(id) ON DELETE SET NULL; END IF; END $$;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS extra_category_ids  UUID[] DEFAULT '{}';
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS tags                TEXT[] DEFAULT '{}';
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS brand_text          TEXT;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS images              TEXT[] DEFAULT '{}';
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS is_published        BOOLEAN DEFAULT FALSE;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS is_featured         BOOLEAN DEFAULT FALSE;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS sort_order          INT DEFAULT 0;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_web_products_category ON web_products(web_category_id);
CREATE INDEX IF NOT EXISTS idx_web_products_subcat   ON web_products(web_sub_category_id);
CREATE INDEX IF NOT EXISTS idx_web_products_family   ON web_products(web_family_id);
CREATE INDEX IF NOT EXISTS idx_web_products_brand    ON web_products(web_brand_id);
CREATE INDEX IF NOT EXISTS idx_web_products_subbrand ON web_products(web_sub_brand_id);
CREATE INDEX IF NOT EXISTS idx_web_products_pub      ON web_products(is_published);

-- 3a. Options shown as dropdowns (e.g. Brand, Length, Color) -------------
CREATE TABLE IF NOT EXISTS web_product_options (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_product_id UUID NOT NULL REFERENCES web_products(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,             -- "Length"
  values         TEXT[] NOT NULL DEFAULT '{}', -- {"1M","50M Roll","100M Roll"}
  position       INT DEFAULT 0
);
-- Older copies of web_product_options: add any missing columns.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_product_options' AND column_name='web_product_id') THEN ALTER TABLE web_product_options ADD COLUMN web_product_id UUID REFERENCES web_products(id) ON DELETE CASCADE; END IF; END $$;
ALTER TABLE web_product_options ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE web_product_options ADD COLUMN IF NOT EXISTS values         TEXT[] DEFAULT '{}';
ALTER TABLE web_product_options ADD COLUMN IF NOT EXISTS position       INT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_web_product_options_product ON web_product_options(web_product_id);

-- 3b. Variants: one per option combination, each linked to a main product
CREATE TABLE IF NOT EXISTS web_product_variants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_product_id UUID NOT NULL REFERENCES web_products(id) ON DELETE CASCADE,
  options        JSONB NOT NULL DEFAULT '{}',  -- {"Brand":"ACL","Length":"100M Roll","Color":"Brown"}
  product_id     UUID NOT NULL REFERENCES products(id),   -- stock + cost come from here
  qty_multiplier NUMERIC(12,4) NOT NULL DEFAULT 1,       -- 1 web unit = N main units (e.g. 0.01 = 1m of a 100m coil)
  mrp            NUMERIC(12,2),
  web_price      NUMERIC(12,2),   -- manual override (normal customers)
  trade_price    NUMERIC(12,2),   -- manual override (trade customers)
  image_url      TEXT,            -- picture to show when this variant is chosen
  is_available   BOOLEAN DEFAULT TRUE,   -- in / out of stock toggle
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_product_variants: add any missing columns.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_product_variants' AND column_name='web_product_id') THEN ALTER TABLE web_product_variants ADD COLUMN web_product_id UUID REFERENCES web_products(id) ON DELETE CASCADE; END IF; END $$;
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS options        JSONB DEFAULT '{}';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_product_variants' AND column_name='product_id') THEN ALTER TABLE web_product_variants ADD COLUMN product_id UUID REFERENCES products(id); END IF; END $$;
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS qty_multiplier NUMERIC(12,4) DEFAULT 1;
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS mrp            NUMERIC(12,2);
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS web_price      NUMERIC(12,2);
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS trade_price    NUMERIC(12,2);
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS image_url      TEXT;
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS is_available   BOOLEAN DEFAULT TRUE;
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS sort_order     INT DEFAULT 0;
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_product_variants ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_web_variants_product ON web_product_variants(web_product_id);
CREATE INDEX IF NOT EXISTS idx_web_variants_main    ON web_product_variants(product_id);

-- 4. Banners ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS web_banners (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT,
  image_url  TEXT NOT NULL,
  link       TEXT,
  sort_order INT DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_banners: add any missing columns.
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS title      TEXT;
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS image_url  TEXT;
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS link       TEXT;
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT TRUE;
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Price rules (brand / category / web category, per tier) ---------
CREATE TABLE IF NOT EXISTS web_price_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL CHECK (scope IN ('brand','category','web_category','web_brand')),
  scope_value TEXT NOT NULL,          -- B2B brand/category name, or web_category / web_brand id
  tier        TEXT NOT NULL DEFAULT 'normal' CHECK (tier IN ('normal','trade')),
  method      TEXT NOT NULL CHECK (method IN ('mrp_discount_pct','cost_markup_pct')),
  value       NUMERIC(6,2) NOT NULL,
  priority    INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_price_rules: add any missing columns.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_price_rules' AND column_name='scope') THEN ALTER TABLE web_price_rules ADD COLUMN scope TEXT CHECK (scope IN ('brand','category','web_category','web_brand')); END IF; END $$;
ALTER TABLE web_price_rules ADD COLUMN IF NOT EXISTS scope_value TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_price_rules' AND column_name='tier') THEN ALTER TABLE web_price_rules ADD COLUMN tier TEXT DEFAULT 'normal' CHECK (tier IN ('normal','trade')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_price_rules' AND column_name='method') THEN ALTER TABLE web_price_rules ADD COLUMN method TEXT CHECK (method IN ('mrp_discount_pct','cost_markup_pct')); END IF; END $$;
ALTER TABLE web_price_rules ADD COLUMN IF NOT EXISTS value       NUMERIC(6,2);
ALTER TABLE web_price_rules ADD COLUMN IF NOT EXISTS priority    INT DEFAULT 0;
ALTER TABLE web_price_rules ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;
ALTER TABLE web_price_rules ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_price_rules ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- 6. Website customers (id = auth.users.id) ---------------------------
CREATE TABLE IF NOT EXISTS web_customers (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  email           TEXT,
  phone           TEXT,
  auth_provider   TEXT,
  default_address JSONB,
  tier            TEXT NOT NULL DEFAULT 'normal' CHECK (tier IN ('normal','trade')),
  trade_status    TEXT NOT NULL DEFAULT 'none' CHECK (trade_status IN ('none','pending','approved','rejected')),
  business_name   TEXT,
  nic_or_reg_no   TEXT,
  customer_id     UUID REFERENCES customers(id),   -- B2B customer row (WEBSITE business)
  is_blocked      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_customers: add any missing columns.
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS full_name       TEXT;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS auth_provider   TEXT;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS default_address JSONB;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_customers' AND column_name='tier') THEN ALTER TABLE web_customers ADD COLUMN tier TEXT DEFAULT 'normal' CHECK (tier IN ('normal','trade')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_customers' AND column_name='trade_status') THEN ALTER TABLE web_customers ADD COLUMN trade_status TEXT DEFAULT 'none' CHECK (trade_status IN ('none','pending','approved','rejected')); END IF; END $$;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS business_name   TEXT;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS nic_or_reg_no   TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_customers' AND column_name='customer_id') THEN ALTER TABLE web_customers ADD COLUMN customer_id UUID REFERENCES customers(id); END IF; END $$;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS is_blocked      BOOLEAN DEFAULT FALSE;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- 7. Website orders ---------------------------------------------------
CREATE TABLE IF NOT EXISTS web_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_order_no     TEXT UNIQUE NOT NULL,
  web_customer_id  UUID NOT NULL REFERENCES web_customers(id),
  delivery_name    TEXT NOT NULL,
  delivery_phone   TEXT NOT NULL,
  delivery_address JSONB NOT NULL,
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('COD','BANK','CARD')),
  payment_status   TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','slip_uploaded','verified','failed')),
  slip_path        TEXT,
  status           TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Confirmed','Packed','Dispatched','Delivered','Cancelled')),
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_note    TEXT,
  staff_note       TEXT,
  source_quote_id  UUID,
  order_id         UUID REFERENCES orders(id),      -- set when office confirms
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_orders: add any missing columns.
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS web_order_no     TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_orders' AND column_name='web_customer_id') THEN ALTER TABLE web_orders ADD COLUMN web_customer_id UUID REFERENCES web_customers(id); END IF; END $$;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS delivery_name    TEXT;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS delivery_phone   TEXT;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS delivery_address JSONB;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_orders' AND column_name='payment_method') THEN ALTER TABLE web_orders ADD COLUMN payment_method TEXT CHECK (payment_method IN ('COD','BANK','CARD')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_orders' AND column_name='payment_status') THEN ALTER TABLE web_orders ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','slip_uploaded','verified','failed')); END IF; END $$;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS slip_path        TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_orders' AND column_name='status') THEN ALTER TABLE web_orders ADD COLUMN status TEXT DEFAULT 'New' CHECK (status IN ('New','Confirmed','Packed','Dispatched','Delivered','Cancelled')); END IF; END $$;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS delivery_fee     NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS total            NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS customer_note    TEXT;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS staff_note       TEXT;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS source_quote_id  UUID;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_orders' AND column_name='order_id') THEN ALTER TABLE web_orders ADD COLUMN order_id UUID REFERENCES orders(id); END IF; END $$;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_web_orders_customer ON web_orders(web_customer_id);
CREATE INDEX IF NOT EXISTS idx_web_orders_status   ON web_orders(status);

CREATE TABLE IF NOT EXISTS web_order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_order_id   UUID NOT NULL REFERENCES web_orders(id) ON DELETE CASCADE,
  web_product_id UUID REFERENCES web_products(id),
  web_variant_id UUID REFERENCES web_product_variants(id),
  variant_label  TEXT,              -- "ACL / 100M Roll / Brown"
  product_id     UUID NOT NULL REFERENCES products(id),
  name           TEXT NOT NULL,
  qty            NUMERIC(12,3) NOT NULL,
  mrp            NUMERIC(12,2),
  unit_price     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(12,2) NOT NULL
);
-- Older copies of web_order_items: add any missing columns.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_order_items' AND column_name='web_order_id') THEN ALTER TABLE web_order_items ADD COLUMN web_order_id UUID REFERENCES web_orders(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_order_items' AND column_name='web_product_id') THEN ALTER TABLE web_order_items ADD COLUMN web_product_id UUID REFERENCES web_products(id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_order_items' AND column_name='web_variant_id') THEN ALTER TABLE web_order_items ADD COLUMN web_variant_id UUID REFERENCES web_product_variants(id); END IF; END $$;
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS variant_label  TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_order_items' AND column_name='product_id') THEN ALTER TABLE web_order_items ADD COLUMN product_id UUID REFERENCES products(id); END IF; END $$;
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS qty            NUMERIC(12,3);
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS mrp            NUMERIC(12,2);
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS unit_price     NUMERIC(12,2);
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS line_total     NUMERIC(12,2);
CREATE INDEX IF NOT EXISTS idx_web_order_items_order ON web_order_items(web_order_id);

-- 8. Quotation requests -----------------------------------------------
CREATE TABLE IF NOT EXISTS web_quote_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no         TEXT UNIQUE NOT NULL,
  web_customer_id  UUID NOT NULL REFERENCES web_customers(id),
  type             TEXT NOT NULL CHECK (type IN ('cart','job')),
  status           TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested','Priced','Sent','Accepted','Rejected','Expired')),
  house_type       TEXT,
  rooms            INT,
  points           JSONB,              -- { lights, plugs, fans, ... }
  attachment_paths TEXT[] DEFAULT '{}',
  customer_note    TEXT,
  staff_note       TEXT,
  subtotal         NUMERIC(12,2) DEFAULT 0,
  discount_amount  NUMERIC(12,2) DEFAULT 0,
  total            NUMERIC(12,2) DEFAULT 0,
  valid_until      DATE,
  sent_at          TIMESTAMPTZ,
  web_order_id     UUID REFERENCES web_orders(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_quote_requests: add any missing columns.
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS quote_no         TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_requests' AND column_name='web_customer_id') THEN ALTER TABLE web_quote_requests ADD COLUMN web_customer_id UUID REFERENCES web_customers(id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_requests' AND column_name='type') THEN ALTER TABLE web_quote_requests ADD COLUMN type TEXT CHECK (type IN ('cart','job')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_requests' AND column_name='status') THEN ALTER TABLE web_quote_requests ADD COLUMN status TEXT DEFAULT 'Requested' CHECK (status IN ('Requested','Priced','Sent','Accepted','Rejected','Expired')); END IF; END $$;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS house_type       TEXT;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS rooms            INT;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS points           JSONB;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS attachment_paths TEXT[] DEFAULT '{}';
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS customer_note    TEXT;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS staff_note       TEXT;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS total            NUMERIC(12,2) DEFAULT 0;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS valid_until      DATE;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS sent_at          TIMESTAMPTZ;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_requests' AND column_name='web_order_id') THEN ALTER TABLE web_quote_requests ADD COLUMN web_order_id UUID REFERENCES web_orders(id); END IF; END $$;
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE web_quote_requests ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_web_quotes_customer ON web_quote_requests(web_customer_id);
CREATE INDEX IF NOT EXISTS idx_web_quotes_status   ON web_quote_requests(status);

CREATE TABLE IF NOT EXISTS web_quote_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       UUID NOT NULL REFERENCES web_quote_requests(id) ON DELETE CASCADE,
  web_product_id UUID REFERENCES web_products(id),
  web_variant_id UUID REFERENCES web_product_variants(id),
  variant_label  TEXT,              -- "ACL / 100M Roll / Brown"
  product_id     UUID NOT NULL REFERENCES products(id),
  name           TEXT NOT NULL,
  qty            NUMERIC(12,3) NOT NULL,
  mrp            NUMERIC(12,2),
  auto_price     NUMERIC(12,2),
  final_price    NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(12,2) NOT NULL
);
-- Older copies of web_quote_items: add any missing columns.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_items' AND column_name='quote_id') THEN ALTER TABLE web_quote_items ADD COLUMN quote_id UUID REFERENCES web_quote_requests(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_items' AND column_name='web_product_id') THEN ALTER TABLE web_quote_items ADD COLUMN web_product_id UUID REFERENCES web_products(id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_items' AND column_name='web_variant_id') THEN ALTER TABLE web_quote_items ADD COLUMN web_variant_id UUID REFERENCES web_product_variants(id); END IF; END $$;
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS variant_label  TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='web_quote_items' AND column_name='product_id') THEN ALTER TABLE web_quote_items ADD COLUMN product_id UUID REFERENCES products(id); END IF; END $$;
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS qty            NUMERIC(12,3);
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS mrp            NUMERIC(12,2);
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS auto_price     NUMERIC(12,2);
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS final_price    NUMERIC(12,2);
ALTER TABLE web_quote_items ADD COLUMN IF NOT EXISTS line_total     NUMERIC(12,2);
CREATE INDEX IF NOT EXISTS idx_web_quote_items_quote ON web_quote_items(quote_id);

-- 9. Shop settings (single row key/value) ------------------------------
CREATE TABLE IF NOT EXISTS web_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Older copies of web_settings: add any missing columns.
ALTER TABLE web_settings ADD COLUMN IF NOT EXISTS key        TEXT;
ALTER TABLE web_settings ADD COLUMN IF NOT EXISTS value      JSONB;
ALTER TABLE web_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
INSERT INTO web_settings (key, value) VALUES
  ('delivery', '{"flat_fee": 0, "free_over": 0}'),
  ('bank',     '{"bank": "", "branch": "", "account_name": "", "account_no": ""}'),
  ('store',    '{"name": "BK Wiring", "phone": "", "whatsapp": "", "address": "", "email": ""}'),
  ('catalog',  '{"allowed_categories": ["Wiring Accessories"]}')
ON CONFLICT (key) DO NOTHING;

-- 10. Private storage bucket for payment slips & quote attachments -----
INSERT INTO storage.buckets (id, name, public)
VALUES ('web-private', 'web-private', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 11. Row Level Security ---------------------------------------------
-- All writes go through server API routes (service role). RLS only
-- protects direct browser access with the anon key.
ALTER TABLE web_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_brands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_suppliers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_product_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_banners        ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_price_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_quote_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_settings       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_families_public ON web_product_families;
CREATE POLICY web_families_public ON web_product_families FOR SELECT USING (is_active);

DROP POLICY IF EXISTS web_brands_public ON web_brands;
CREATE POLICY web_brands_public ON web_brands FOR SELECT USING (is_active);
-- web_suppliers: no public policy (staff only).

DROP POLICY IF EXISTS web_categories_public ON web_categories;
CREATE POLICY web_categories_public ON web_categories FOR SELECT USING (is_active);

DROP POLICY IF EXISTS web_products_public ON web_products;
CREATE POLICY web_products_public ON web_products FOR SELECT USING (is_published);

DROP POLICY IF EXISTS web_options_public ON web_product_options;
CREATE POLICY web_options_public ON web_product_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM web_products p WHERE p.id = web_product_id AND p.is_published)
);
-- Variants hold the cost link, so they are read only through server APIs (no public policy).

DROP POLICY IF EXISTS web_banners_public ON web_banners;
CREATE POLICY web_banners_public ON web_banners FOR SELECT USING (is_active);

DROP POLICY IF EXISTS web_customers_own ON web_customers;
CREATE POLICY web_customers_own ON web_customers FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS web_orders_own ON web_orders;
CREATE POLICY web_orders_own ON web_orders FOR SELECT USING (auth.uid() = web_customer_id);

DROP POLICY IF EXISTS web_order_items_own ON web_order_items;
CREATE POLICY web_order_items_own ON web_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM web_orders o WHERE o.id = web_order_id AND o.web_customer_id = auth.uid())
);

DROP POLICY IF EXISTS web_quotes_own ON web_quote_requests;
CREATE POLICY web_quotes_own ON web_quote_requests FOR SELECT USING (auth.uid() = web_customer_id);

DROP POLICY IF EXISTS web_quote_items_own ON web_quote_items;
CREATE POLICY web_quote_items_own ON web_quote_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM web_quote_requests q WHERE q.id = quote_id AND q.web_customer_id = auth.uid())
);
-- web_price_rules and web_settings: no public policy (server only).

-- 12. Later additions (safe to re-run) ---------------------------------
ALTER TABLE web_product_families ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Search text: name + tags + brand + specs, lower case, no spaces/dots/dashes,
-- so "1/113" finds "1/1.13mm". The app refreshes it on every product save.
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS search_key TEXT;
UPDATE web_products p SET search_key = lower(regexp_replace(translate(
  concat_ws(' ', p.name, p.brand_text, array_to_string(p.tags, ' '),
    (SELECT string_agg(b.name, ' ') FROM web_brands b WHERE b.id IN (p.web_brand_id, p.web_sub_brand_id))),
  '²', '2'), '[.\-_]', '', 'g'))
WHERE p.search_key IS NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_web_products_search_key ON web_products USING gin (search_key gin_trgm_ops);

-- 13. Home page promotion strip (the black row under the menu) ---------
-- Each item links to a category, brand, product or any URL and can show a
-- badge: typed text (e.g. "27% OFF"), or "auto" = the biggest discount found.
CREATE TABLE IF NOT EXISTS web_promo_strip (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  image_url   TEXT,
  link_type   TEXT NOT NULL DEFAULT 'category',
  link_value  TEXT,
  badge_mode  TEXT NOT NULL DEFAULT 'none',
  badge_text  TEXT,
  badge_color TEXT NOT NULL DEFAULT 'red',
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS image_url   TEXT;
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS link_type   TEXT DEFAULT 'category';
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS link_value  TEXT;
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS badge_mode  TEXT DEFAULT 'none';
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS badge_text  TEXT;
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT 'red';
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS sort_order  INT DEFAULT 0;
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;
ALTER TABLE web_promo_strip ADD COLUMN IF NOT EXISTS ends_at     TIMESTAMPTZ;
ALTER TABLE web_promo_strip ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_promo_strip_public ON web_promo_strip;
CREATE POLICY web_promo_strip_public ON web_promo_strip FOR SELECT USING (is_active);
