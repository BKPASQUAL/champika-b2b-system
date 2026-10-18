-- Create customer_unlock_requests table for Overdue Invoicing Authorization
-- Rule: 60+ Days for Orange (Orel Corporation) & Sierra Cables Plc items, 90+ Days for other suppliers
CREATE TABLE IF NOT EXISTS public.customer_unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_by_name TEXT,
    requested_by_email TEXT,
    requested_by_role TEXT DEFAULT 'rep', -- 'rep', 'distribution', 'office', etc.
    unlock_type TEXT NOT NULL DEFAULT 'one_time', -- 'one_time', '7_days', '14_days'
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'used', 'expired', 'resolved'
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_in_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    overdue_details JSONB, -- Snapshot of overdue invoices (invoice_no, days, threshold, amount, suppliers)
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for customer & status lookup
CREATE INDEX IF NOT EXISTS idx_customer_unlock_requests_customer_status
ON public.customer_unlock_requests(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_unlock_requests_status 
ON public.customer_unlock_requests(status);

CREATE INDEX IF NOT EXISTS idx_customer_unlock_requests_created_at
ON public.customer_unlock_requests(created_at DESC);
