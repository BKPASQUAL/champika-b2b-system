-- Supplier monthly claim bills (e.g. Orange monthly "Document Discount" bill)
-- Orange sends a bill after each month listing items × our selling price,
-- with a discount % that changes every month. That discount is spread over
-- the items and lowers their actual cost in the Actual Profit report.
-- A claim bill is discount only: it does NOT add stock or touch supplier payments.
-- On save, each item's discount is divided over the units of that item PURCHASED
-- from the supplier in the claim period: already-sold units get a lower invoice-line
-- cost, unsold units get a lower stock (FIFO layer) cost.
-- Run this in the Supabase SQL Editor.

create table if not exists public.supplier_claim_bills (
  id uuid primary key default gen_random_uuid(),
  claim_no text not null,
  business_id uuid not null references public.businesses(id),
  supplier_id uuid references public.suppliers(id),
  claim_date date not null default current_date,
  period_from date not null,
  period_to date not null,
  gross_total numeric not null default 0,
  discount_percent numeric not null default 0,
  discount_amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists supplier_claim_bills_supplier_no_uidx
  on public.supplier_claim_bills (supplier_id, claim_no);
create index if not exists supplier_claim_bills_period_idx
  on public.supplier_claim_bills (business_id, period_from, period_to);

create table if not exists public.supplier_claim_bill_items (
  id uuid primary key default gen_random_uuid(),
  claim_bill_id uuid not null references public.supplier_claim_bills(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric not null default 0,
  unit_price numeric not null default 0,      -- price on the claim bill (our selling price)
  gross_value numeric not null default 0,     -- quantity × unit_price
  discount_amount numeric not null default 0, -- this line's share of the document discount
  discount_per_unit numeric not null default 0,
  cost_before numeric,                        -- actual cost per unit when entered (for reference)
  created_at timestamptz not null default now()
);

create index if not exists supplier_claim_bill_items_bill_idx
  on public.supplier_claim_bill_items (claim_bill_id);
create index if not exists supplier_claim_bill_items_product_idx
  on public.supplier_claim_bill_items (product_id);

-- Every cost a claim lowered, so it can be put back exactly if the claim is deleted.
--   target_type = 'purchase_item' : purchase_items.actual_unit_cost (bought in the period)
--               = 'cost_layer'    : product_cost_layers.cost_price (unsold stock from those purchases)
--               = 'order_item'    : order_items.actual_unit_cost (units from those purchases already sold)
--               = 'product'       : products.actual_cost_price (when the latest purchase is in the period)
-- Invoice lines are matched by order + product (an invoice edit replaces line ids).
create table if not exists public.supplier_claim_cost_adjustments (
  id uuid primary key default gen_random_uuid(),
  claim_bill_id uuid not null references public.supplier_claim_bills(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  order_id uuid,                          -- only for order_item
  product_id uuid not null,
  units numeric not null default 0,
  reduction_per_unit numeric not null,    -- subtracted from the target's cost
  cost_before numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists supplier_claim_cost_adj_bill_idx
  on public.supplier_claim_cost_adjustments (claim_bill_id);
create index if not exists supplier_claim_cost_adj_order_idx
  on public.supplier_claim_cost_adjustments (order_id, product_id);
