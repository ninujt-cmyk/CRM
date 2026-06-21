-- 1. Add industry column to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS industry text DEFAULT 'general' CHECK (industry IN ('general', 'real_estate'));

-- 2. Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    type text CHECK (type IN ('apartment', 'villa', 'plot', 'commercial', 'office')),
    listing_type text CHECK (listing_type IN ('sale', 'rent')),
    price numeric NOT NULL,
    bhk_config text,
    area_sqft numeric,
    location text NOT NULL,
    status text DEFAULT 'available' CHECK (status IN ('available', 'booked', 'sold', 'rented')),
    developer_name text,
    possession_date date,
    images text[],
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for properties" ON properties
    FOR ALL USING (tenant_id = (select tenant_id::uuid from users where id = auth.uid()));

-- 3. Create lead_custom_fields table for dynamic metadata (budget, bhk pref, etc.)
CREATE TABLE IF NOT EXISTS lead_custom_fields (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
    field_key text NOT NULL,
    field_value text,
    UNIQUE(lead_id, field_key)
);

-- Enable RLS for lead_custom_fields
ALTER TABLE lead_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for lead_custom_fields" ON lead_custom_fields
    FOR ALL USING (tenant_id = (select tenant_id::uuid from users where id = auth.uid()));

-- 4. Create site_visits table
CREATE TABLE IF NOT EXISTS site_visits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
    assigned_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'conducted', 'cancelled', 'rescheduled', 'no_show')),
    feedback text,
    rating int CHECK (rating >= 1 AND rating <= 5),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for site_visits
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for site_visits" ON site_visits
    FOR ALL USING (tenant_id = (select tenant_id::uuid from users where id = auth.uid()));
