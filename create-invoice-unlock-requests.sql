-- Create invoice_unlock_requests table for One-Time Invoice Edit Authorization
CREATE TABLE IF NOT EXISTS public.invoice_unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_by_name TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'used', 'expired'
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    unlock_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster status & invoice queries
CREATE INDEX IF NOT EXISTS idx_invoice_unlock_requests_invoice_status 
ON public.invoice_unlock_requests(invoice_id, status);

CREATE INDEX IF NOT EXISTS idx_invoice_unlock_requests_token 
ON public.invoice_unlock_requests(unlock_token);

-- Insert Default Admin Unlock PIN into app_settings if not present
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('invoice_unlock_pin', '{"pin": "889900"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
