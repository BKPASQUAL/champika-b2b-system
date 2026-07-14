-- Allow creating a loading_sheets row (a "folder") before a lorry is picked.
ALTER TABLE loading_sheets ALTER COLUMN lorry_number DROP NOT NULL;
