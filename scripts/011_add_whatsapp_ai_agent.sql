-- Migration: Add whatsapp_ai_agent_enabled column to tenant_settings
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS whatsapp_ai_agent_enabled BOOLEAN DEFAULT false;
