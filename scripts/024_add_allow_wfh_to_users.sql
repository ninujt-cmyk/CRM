-- Add allow_wfh boolean column to users table to control Work From Home / Office Geofence enforcement
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS allow_wfh BOOLEAN DEFAULT false;

-- Create index for fast lookups during access verification
CREATE INDEX IF NOT EXISTS idx_users_allow_wfh ON public.users(allow_wfh);
