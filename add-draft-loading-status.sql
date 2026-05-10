-- Add 'Draft' status to loading_sheet_status enum
-- Used for lorry pre-assignment at the Approved stage before orders move to Processing
ALTER TYPE loading_sheet_status ADD VALUE IF NOT EXISTS 'Draft' BEFORE 'In Transit';
