-- 1. Add unicorn_api_key to tenant_settings
ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS unicorn_api_key text;
