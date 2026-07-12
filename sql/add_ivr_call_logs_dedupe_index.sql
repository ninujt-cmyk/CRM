-- ==============================================================================
-- SAFE DATABASE-LEVEL IDEMPOTENCY & UNIQUENESS GUARD FOR IVR_CALL_LOGS
-- ==============================================================================
-- Run this SQL in your Supabase SQL Editor to block duplicate webhook replays
-- or infinite retry loops at the PostgreSQL database layer.
-- ==============================================================================

-- 1. Remove exact duplicate rows currently in ivr_call_logs (if any remain)
-- Keeps the earliest log entry for each (batch_id, mobile_number, call_duration, attempt_num)
DELETE FROM public.ivr_call_logs a
USING public.ivr_call_logs b
WHERE a.id > b.id
  AND a.batch_id IS NOT NULL
  AND a.batch_id = b.batch_id
  AND a.mobile_number = b.mobile_number
  AND COALESCE(a.call_duration, 0) = COALESCE(b.call_duration, 0)
  AND COALESCE(a.attempt_num, 1) = COALESCE(b.attempt_num, 1);

-- 2. Create a unique index to prevent future duplicates for the same batch & call attempt
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ivr_call_log_attempt
ON public.ivr_call_logs (batch_id, mobile_number, COALESCE(call_duration, 0), COALESCE(attempt_num, 1))
WHERE batch_id IS NOT NULL;
