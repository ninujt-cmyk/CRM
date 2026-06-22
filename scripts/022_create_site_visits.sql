-- Migration: Create Site Visits
-- 022_create_site_visits.sql

CREATE TABLE IF NOT EXISTS public.site_visits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'conducted', 'cancelled', 'no_show', 'rescheduled')),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_site_visits_tenant ON public.site_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_lead ON public.site_visits(lead_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_property ON public.site_visits(property_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_assigned ON public.site_visits(assigned_to);

-- RLS
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site visits viewable by users in same tenant"
ON public.site_visits FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Site visits insertable by users in same tenant"
ON public.site_visits FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Site visits updatable by users in same tenant"
ON public.site_visits FOR UPDATE
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Site visits deletable by users in same tenant"
ON public.site_visits FOR DELETE
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
