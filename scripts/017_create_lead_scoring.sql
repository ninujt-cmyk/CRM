-- 1. Add score column to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;

-- 2. Create lead_score_logs table to track score history
CREATE TABLE IF NOT EXISTS public.lead_score_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    points_changed integer NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.lead_score_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_score_logs
CREATE POLICY "Tenant isolation for lead_score_logs"
  ON public.lead_score_logs FOR ALL
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid())
  );

-- Create index for performance
CREATE INDEX idx_lead_score_logs_lead_id ON public.lead_score_logs(lead_id);
CREATE INDEX idx_leads_score ON public.leads(score DESC);
