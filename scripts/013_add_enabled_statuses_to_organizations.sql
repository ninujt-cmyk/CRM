-- Migration to add enabled_statuses and workflow_triggers columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS enabled_statuses JSONB DEFAULT '["new", "contacted", "Interested", "Documents_Sent", "Login Done", "Transferred to KYC", "Underwriting", "Approved", "Disbursed", "Not_Interested", "follow_up", "not_eligible", "nr", "self_employed", "recycle_pool"]'::jsonb,
ADD COLUMN IF NOT EXISTS workflow_triggers JSONB DEFAULT '{
  "on_document_request": "Documents_Sent",
  "on_kyc_transfer": "Transferred to KYC",
  "on_revenue_marked": "Disbursed",
  "on_login_done": "Login Done"
}'::jsonb;
