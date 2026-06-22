-- Create deals table for CRM transaction management
CREATE TABLE IF NOT EXISTS public.deals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    agent_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    stage text DEFAULT 'pre_approval' CHECK (stage IN ('pre_approval', 'negotiation', 'contract_signed', 'registration', 'closed_won', 'closed_lost')),
    amount numeric(15,2),
    expected_close_date date,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Combined RLS Policies
CREATE POLICY "Telecallers can view assigned deals in their tenant"
  ON public.deals FOR SELECT
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid()) AND
    (agent_id = auth.uid() OR exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  );

CREATE POLICY "Telecallers can update assigned deals in their tenant"
  ON public.deals FOR UPDATE
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid()) AND
    (agent_id = auth.uid() OR exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  );

CREATE POLICY "Anyone in tenant can insert deals"
  ON public.deals FOR INSERT
  WITH CHECK (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid())
  );

CREATE POLICY "Admins can delete deals"
  ON public.deals FOR DELETE
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid()) AND
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Create updated_at trigger for deals
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_deals_tenant_id ON public.deals(tenant_id);
CREATE INDEX idx_deals_lead_id ON public.deals(lead_id);
CREATE INDEX idx_deals_agent_id ON public.deals(agent_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
