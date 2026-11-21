-- Website products: optional warranty period + terms (also in supabase/migrations/website_shop.sql §15)
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS warranty_period TEXT;
ALTER TABLE web_products ADD COLUMN IF NOT EXISTS warranty_terms  TEXT;
