-- Function: notify_order_assignment (Safe Version)
CREATE OR REPLACE FUNCTION public.notify_order_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if assigned_user changed and is not null
  IF (NEW.assigned_user IS DISTINCT FROM OLD.assigned_user) AND (NEW.assigned_user IS NOT NULL) THEN
    
    -- Safe Insert: Ignore conflicts if notification already exists
    BEGIN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            order_id,
            link
        ) VALUES (
            NEW.assigned_user,
            'assignment',
            'New Order Assignment',
            'You have been assigned order #' || COALESCE(NEW.order_id, 'Unknown'),
            NEW.id,
            '/orders/' || NEW.order_id
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error but DO NOT FAIL the transaction
        RAISE WARNING 'Failed to send assignment notification: %', SQLERRM;
    END;
    
  END IF;
  RETURN NEW;
END;
$$;
