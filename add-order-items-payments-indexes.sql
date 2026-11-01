-- Speeds up loading invoice items and payments.
-- Without these, joining order_items into invoice lists took 6s+ and hit the
-- statement timeout (error 57014). Safe to run more than once.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (created_at DESC);
