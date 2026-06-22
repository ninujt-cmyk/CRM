-- 1. Create automations table
CREATE TABLE IF NOT EXISTS public.automations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    trigger_type text NOT NULL, -- e.g., 'TIME_IN_STATUS', 'LEAD_SCORE_ABOVE'
    trigger_condition jsonb NOT NULL, -- e.g., {"status": "new", "hours": 48}
    action_type text NOT NULL, -- e.g., 'SEND_WHATSAPP', 'ASSIGN_TASK', 'UPDATE_STATUS'
    action_payload jsonb NOT NULL, -- e.g., {"message": "Hi there!"}
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for automations
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for automations"
  ON public.automations FOR ALL
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid())
  );

-- 2. Create automation_logs table to prevent duplicate actions and track success
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    automation_id uuid REFERENCES public.automations(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    status text NOT NULL, -- 'SUCCESS', 'FAILED'
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for automation_logs"
  ON public.automation_logs FOR ALL
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid())
  );

-- Create index to quickly check if a lead has already been processed by an automation
CREATE UNIQUE INDEX idx_automation_logs_unique_exec ON public.automation_logs(automation_id, lead_id);
