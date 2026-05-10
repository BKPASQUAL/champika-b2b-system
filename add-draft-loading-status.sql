-- Create loading_sheet_status enum if it doesn't exist, then ensure 'Draft' value is present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loading_sheet_status') THEN
    CREATE TYPE loading_sheet_status AS ENUM ('Draft', 'In Transit', 'Completed');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Draft' AND enumtypid = 'loading_sheet_status'::regtype) THEN
      ALTER TYPE loading_sheet_status ADD VALUE 'Draft' BEFORE 'In Transit';
    END IF;
  END IF;
END $$;
