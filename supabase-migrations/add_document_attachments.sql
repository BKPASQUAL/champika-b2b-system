-- ============================================================
-- Migration: Add document_attachments table
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

create table if not exists public.document_attachments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,          -- e.g. 'invoice', 'purchase', 'supplier', 'customer'
  entity_id    uuid not null,          -- the UUID of the parent record
  file_name    text not null,          -- original file name
  file_url     text not null,          -- public Supabase Storage URL
  file_path    text not null,          -- storage bucket path (for deletion)
  file_type    text not null,          -- MIME type
  file_size    bigint not null,        -- bytes
  label        text,                   -- optional user-supplied label/description
  created_at   timestamptz not null default now()
);

-- Index for fast look-ups by entity
create index if not exists idx_doc_attachments_entity
  on public.document_attachments (entity_type, entity_id);

-- Row Level Security (optional — enable if you use RLS)
-- alter table public.document_attachments enable row level security;
