-- Website categories: "See it on your wall" colour preview toggle (also in supabase/migrations/website_shop.sql §16)
ALTER TABLE web_categories ADD COLUMN IF NOT EXISTS wall_preview BOOLEAN NOT NULL DEFAULT FALSE;

-- Turn it on for "Switches & Sockets" only for now (more can be switched on later in the admin).
UPDATE web_categories SET wall_preview = (name ILIKE 'switches & sockets');
