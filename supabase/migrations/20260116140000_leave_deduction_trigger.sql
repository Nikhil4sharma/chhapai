-- Migration: Add trigger to deduct leave balance on approval
-- Created: 2026-01-16
-- Purpose: Automatically deduct days from leave_balances when a request is approved.

CREATE OR REPLACE FUNCTION public.handle_leave_approval()
RETURNS TRIGGER AS $$
DECLARE
    request_year INTEGER;
BEGIN
    -- Only proceed if status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        request_year := EXTRACT(YEAR FROM NEW.start_date);
        
        -- Check if balance record exists
        IF EXISTS (
            SELECT 1 FROM public.leave_balances 
            WHERE user_id = NEW.user_id 
            AND leave_type_id = NEW.leave_type_id 
            AND year = request_year
        ) THEN
            -- Update existing balance
            UPDATE public.leave_balances
            SET used = used + NEW.days_count,
                updated_at = now()
            WHERE user_id = NEW.user_id 
            AND leave_type_id = NEW.leave_type_id 
            AND year = request_year;
        ELSE
            -- Create new balance record if not exists (assuming default allowance needs to be fetched or set to 0 and let Admin fix)
            -- Ideally, allowances are pre-populated. If not, we insert with 0 allowance (needs admin attention) or fetch from type.
            INSERT INTO public.leave_balances (user_id, leave_type_id, year, balance, used)
            SELECT 
                NEW.user_id, 
                NEW.leave_type_id, 
                request_year, 
                lt.days_allowed_per_year, -- Fetch default allowance from type
                NEW.days_count
            FROM public.leave_types lt
            WHERE lt.id = NEW.leave_type_id;
        END IF;
    END IF;

    -- Optional: If status changed FROM approved TO something else (cancelled/rejected after fact), refund it?
    -- User requirement: "Approved leave accordingly leave balance se deduct ho, rejected leave na deduct ho"
    -- Doesn't explicitly ask for refund logic on cancellation of approved, but good practice. 
    -- For now adhering strictly: "rejected leave na deduct ho" (implied: only approved deducts).
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow clean recreate
DROP TRIGGER IF EXISTS on_leave_approval ON public.leave_requests;

CREATE TRIGGER on_leave_approval
    AFTER UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_leave_approval();
