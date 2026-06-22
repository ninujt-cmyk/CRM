-- 1. Create portal_credentials table to store integration settings
CREATE TABLE IF NOT EXISTS public.portal_credentials (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    portal_name text NOT NULL, -- e.g., '99acres', 'magicbricks', 'housing'
    api_key text, -- Encrypted or plain token for auth
    webhook_secret text, -- Secret used to verify incoming webhook payloads
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tenant_id, portal_name)
);

-- Enable RLS
ALTER TABLE public.portal_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for portal_credentials"
  ON public.portal_credentials FOR ALL
  USING (
    tenant_id = (select tenant_id::uuid from users where id = auth.uid())
  );
