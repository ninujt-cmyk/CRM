-- Migration to add enabled_modules to organizations table

-- Add enabled_modules column to organizations table with default core modules
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT '["leads", "dialer", "team", "analytics"]'::jsonb;

-- Update existing organizations to have all modules enabled so we don't break existing tenants immediately
UPDATE organizations SET enabled_modules = '["leads", "dialer", "team", "attendance", "whatsapp", "analytics", "wallboard", "ivr", "files", "logs"]'::jsonb WHERE enabled_modules IS NULL OR enabled_modules = '["leads", "dialer", "team", "analytics"]'::jsonb;
