-- Create ui_modules table
CREATE TABLE IF NOT EXISTS public.ui_modules (
    module_key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    page_type TEXT NOT NULL CHECK (page_type IN ('product_card', 'order_details')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ui_visibility_rules table
CREATE TABLE IF NOT EXISTS public.ui_visibility_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('department', 'user')),
    scope_id TEXT NOT NULL, -- department name or user_id
    module_key TEXT NOT NULL REFERENCES public.ui_modules(module_key) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(scope_type, scope_id, module_key)
);

-- Enable RLS
ALTER TABLE public.ui_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_visibility_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ui_modules
-- Everyone can read modules
CREATE POLICY "Allow read access for all authenticated users" ON public.ui_modules
    FOR SELECT TO authenticated USING (true);

-- Only admins can modify modules (optional, mainly for dev/maintenance)
CREATE POLICY "Allow write access for admins" ON public.ui_modules
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'super_admin')
        )
    );

-- RLS Policies for ui_visibility_rules
-- Everyone can read rules to determine what to show
CREATE POLICY "Allow read access for all authenticated users" ON public.ui_visibility_rules
    FOR SELECT TO authenticated USING (true);

-- Only admins can modify rules
CREATE POLICY "Allow write access for admins" ON public.ui_visibility_rules
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'super_admin')
        )
    );

-- Seed Initial Modules
INSERT INTO public.ui_modules (module_key, label, page_type, description) VALUES
-- Product Card Modules
('pc_product_name', 'Product Name', 'product_card', 'The name of the product'),
('pc_status_badge', 'Status Badge', 'product_card', 'Current stage badge (e.g., Design, Production)'),
('pc_quantity', 'Quantity', 'product_card', 'Ordered quantity'),
('pc_delivery_date', 'Delivery Date', 'product_card', 'Expected delivery date'),
('pc_assigned_to', 'Assigned To', 'product_card', 'User assigned to this item'),
('pc_brief_button', 'Brief Button', 'product_card', 'Button to view design/production brief'),
('pc_upload_button', 'Upload Button', 'product_card', 'Button to upload files'),
('pc_assign_user_button', 'Assign User Button', 'product_card', 'Button to assign a user'),
('pc_assign_dept_button', 'Assign Dept Button', 'product_card', 'Button to assign a department'),
('pc_process_button', 'Process Button', 'product_card', 'Button to move to next stage'),
('pc_add_note_button', 'Add Note Button', 'product_card', 'Button to add internal notes'),
('pc_specs', 'Specifications', 'product_card', 'Collapsible specifications section'),
('pc_files', 'Files', 'product_card', 'List of attached files'),

-- Order Details Page Modules
('od_customer_info', 'Customer Info', 'order_details', 'Customer name, phone, email'),
('od_shipping_address', 'Shipping Address', 'order_details', 'Delivery address'),
('od_order_total', 'Order Total', 'order_details', 'Total order amount'),
('od_payment_status', 'Payment Status', 'order_details', 'Paid/Pending status'),
('od_payment_card', 'Payment Management', 'order_details', 'Card to add/view payments'),
('od_timeline', 'Timeline', 'order_details', 'Order history/timeline'),
('od_internal_notes', 'Internal Notes', 'order_details', 'Internal communication notes');
