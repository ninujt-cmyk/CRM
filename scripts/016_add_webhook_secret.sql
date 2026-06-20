-- Migration: Add webhook_secret to tenant_settings

-- Add column if it doesn't exist
ALTER TABLE tenant_settings 
ADD COLUMN IF NOT EXISTS webhook_secret UUID DEFAULT gen_random_uuid();

-- Create an index to quickly lookup tenants by their webhook secret
CREATE INDEX IF NOT EXISTS idx_tenant_settings_webhook_secret ON tenant_settings(webhook_secret);
