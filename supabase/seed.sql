-- Insert UI Modules for Product Card Visibility Control

INSERT INTO public.ui_modules (module_key, label, page_type, description)
VALUES 
    -- Indicators & Badges
    ('priority_badge', 'Priority Badge', 'product_card', 'Colored strip and icon indicating order priority'),
    ('manager_badge', 'Manager Name', 'product_card', 'Name of the sales manager assigned to the order'),
    ('delivery_date', 'Delivery Date', 'product_card', 'Expected delivery date of the item'),
    
    -- Content & Briefs
    ('design_brief', 'Design Brief', 'product_card', 'Instructions for the design team'),
    ('prepress_brief', 'Prepress Brief', 'product_card', 'Instructions for the prepress team'),
    ('production_brief', 'Production Brief', 'product_card', 'Instructions for production'),
    ('brief', 'Order Brief', 'product_card', 'General order instructions'),
    ('workflow_notes', 'Workflow History', 'product_card', 'Latest note and history button'),
    ('specifications', 'Product Specs', 'product_card', 'Detailed product specifications table'),
    ('outsource_info', 'Outsource Info', 'product_card', 'Vendor details if outsourced'),

    -- Action Buttons
    ('send_approval_button', 'Send for Approval', 'product_card', 'Button to send item for internal or client approval'),
    ('revision_button', 'Revision Button', 'product_card', 'Button to request revision if rejected'),
    ('production_handoff_button', 'Production Handoff', 'product_card', 'Button to move approved item to production'),
    ('outsource_button', 'Outsource Button', 'product_card', 'Button to assign item to an external vendor'),
    ('process_button', 'Process Button', 'product_card', 'Main action button (Start, Complete, Process)'),

    -- Order Details Page Modules
    ('od_header', 'Order Header', 'order_details', 'Top section with Order ID and main actions'),
    ('od_status_card', 'Status Card', 'order_details', 'Summary card showing delivery date and overall status'),
    ('od_items_list', 'Items List', 'order_details', 'List of all product items in the order'),
    ('od_timeline', 'Timeline & Notes', 'order_details', 'Communication history and notes section'),
    ('od_payment_card', 'Payment & Financials', 'order_details', 'Payment details, balance, and collection options')

ON CONFLICT (module_key, page_type) 
DO UPDATE SET 
    label = EXCLUDED.label,
    description = EXCLUDED.description;
