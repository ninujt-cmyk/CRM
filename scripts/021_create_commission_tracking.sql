-- Migration: Add Commission Tracking to Deals
-- 021_create_commission_tracking.sql

-- 1. Add commission columns to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS expected_commission DECIMAL(15, 2) GENERATED ALWAYS AS (amount * (commission_percentage / 100)) STORED;

-- 2. Update leaderboard view to include commission
DROP VIEW IF EXISTS agent_leaderboard_view;

CREATE OR REPLACE VIEW agent_leaderboard_view AS
SELECT 
    d.tenant_id,
    u.id AS agent_id,
    u.full_name AS agent_name,
    u.avatar_url,
    COUNT(d.id) AS deals_won,
    COALESCE(SUM(d.amount), 0) AS total_revenue,
    COALESCE(SUM(d.expected_commission), 0) AS total_commission,
    MAX(d.updated_at) AS last_deal_date
FROM 
    users u
LEFT JOIN 
    deals d ON u.id = d.assigned_to AND d.stage = 'Closed Won'
WHERE 
    u.role = 'telecaller'
GROUP BY 
    d.tenant_id, u.id, u.full_name, u.avatar_url;

-- Ensure RLS isn't broken by the view recreation
-- Views run with invoker privileges by default, so it uses the RLS of underlying tables.
