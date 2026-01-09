-- Create order_activity_logs table for comprehensive department-wise activity tracking
CREATE TABLE IF NOT EXISTS public.order_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    department TEXT NOT NULL CHECK (department IN ('sales', 'design', 'prepress', 'production', 'dispatch')),
    action TEXT NOT NULL CHECK (action IN ('created', 'assigned', 'started', 'completed', 'rejected', 'dispatched', 'note_added', 'file_uploaded', 'status_changed')),
    message TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Additional metadata (optional JSONB for flexibility)
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for efficient querying
CREATE INDEX idx_order_activity_logs_order_id ON public.order_activity_logs(order_id);
CREATE INDEX idx_order_activity_logs_item_id ON public.order_activity_logs(item_id);
CREATE INDEX idx_order_activity_logs_department ON public.order_activity_logs(department);
CREATE INDEX idx_order_activity_logs_created_at ON public.order_activity_logs(created_at DESC);
CREATE INDEX idx_order_activity_logs_order_dept ON public.order_activity_logs(order_id, department);

-- Enable RLS
ALTER TABLE public.order_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_activity_logs
CREATE POLICY "Users can view activity logs for accessible orders"
ON public.order_activity_logs FOR SELECT
TO authenticated
USING (
    -- Same access rules as orders table
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_activity_logs.order_id
        AND (
            public.has_role(auth.uid(), 'admin') OR
            public.has_role(auth.uid(), 'sales') OR
            EXISTS (
                SELECT 1 FROM public.order_items oi
                WHERE oi.order_id = o.id
                AND oi.assigned_department = public.get_user_department(auth.uid())
            )
        )
    )
);

CREATE POLICY "Authenticated users can insert activity logs"
ON public.order_activity_logs FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Add department column to timeline table if it doesn't exist (for backward compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'timeline' 
        AND column_name = 'department'
    ) THEN
        ALTER TABLE public.timeline ADD COLUMN department TEXT;
    END IF;
END $$;

-- Enable realtime for activity logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_activity_logs;

