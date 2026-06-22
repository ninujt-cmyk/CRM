-- Migration: Add Shift Status to Users
-- 023_add_shift_status.sql

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_on_shift BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_shift_change TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update the view so it doesn't break
-- Since we added columns to the base table, views that use SELECT * might need a refresh, but we didn't use SELECT * in leaderboard view.
