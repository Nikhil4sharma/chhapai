
-- Create proforma_invoices table
CREATE TABLE IF NOT EXISTS public.proforma_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pi_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    
    -- Store structured data for regeneration
    purchaser_details JSONB NOT NULL, -- {name, address, gst}
    items JSONB NOT NULL, -- Array of product lines
    financials JSONB NOT NULL, -- {shipping, gst_rate, total_amount}
    
    status TEXT DEFAULT 'generated',
    
    -- Searchable text column for faster lookup if needed (or just use pi_number)
    search_text TEXT GENERATED ALWAYS AS (
        pi_number || ' ' || (purchaser_details->>'name')
    ) STORED
);

-- RLS Policies
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow view proforma invoices for authenticated users" 
ON public.proforma_invoices FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow insert proforma invoices for authenticated users" 
ON public.proforma_invoices FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);
