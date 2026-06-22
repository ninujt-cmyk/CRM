-- 1. Create a secure view for the Leaderboard
-- This view aggregates deals closed and total revenue per agent
CREATE OR REPLACE VIEW public.agent_leaderboard_view AS
SELECT 
    u.tenant_id,
    u.id as agent_id,
    u.full_name as agent_name,
    COUNT(d.id) FILTER (WHERE d.stage = 'Closed Won') as deals_closed,
    COALESCE(SUM(d.amount) FILTER (WHERE d.stage = 'Closed Won'), 0) as total_revenue,
    COUNT(d.id) as total_deals_handled
FROM 
    public.users u
LEFT JOIN 
    public.deals d ON u.id = d.agent_id
WHERE 
    u.role = 'telecaller' AND u.is_active = true
GROUP BY 
    u.tenant_id, u.id, u.full_name;

-- 2. Grant access to authenticated users
GRANT SELECT ON public.agent_leaderboard_view TO authenticated;
GRANT SELECT ON public.agent_leaderboard_view TO service_role;
