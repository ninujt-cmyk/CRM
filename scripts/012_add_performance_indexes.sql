-- Add composite indexes to optimize slow queries shown in PostgREST/Auth timeouts

-- 1. Optimize leads query (filters on assigned_to, status, disbursed_at)
-- This speeds up requests like GET /leads?select=disbursed_amount&assigned_to=eq.X&status=ilike.disbursed...
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_status_disbursed_at 
ON public.leads (assigned_to, status, disbursed_at);

-- 2. Optimize follow-ups queries (filters on user_id, status, completed_at or scheduled_at)
-- This speeds up requests like HEAD /follow_ups?select=*&user_id=eq.X&status=eq.pending
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id_status_completed_at 
ON public.follow_ups (user_id, status, completed_at);

CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id_status_scheduled_at 
ON public.follow_ups (user_id, status, scheduled_at);

-- 3. Optimize call logs queries (filters on user_id, created_at)
-- This speeds up daily stat count queries
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id_created_at 
ON public.call_logs (user_id, created_at);
