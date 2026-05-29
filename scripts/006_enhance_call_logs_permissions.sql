-- Enhanced call logs permissions and features
-- This script adds more granular permissions and improves the call logs system

-- Add new columns for better call tracking
ALTER TABLE public.call_logs 
ADD COLUMN IF NOT EXISTS call_status text CHECK (call_status IN ('connected', 'no_answer', 'busy', 'voicemail', 'failed', 'in_progress')) DEFAULT 'connected',
ADD COLUMN IF NOT EXISTS call_result text CHECK (call_result IN ('successful', 'callback_requested', 'not_interested', 'wrong_number', 'attempted', 'completed')) DEFAULT 'attempted',
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_call_logs_updated_at ON public.call_logs;
CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON public.call_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enhanced RLS policy for team-based access (team leads can view their team's calls)
CREATE POLICY "Team leads can view team call logs"
  ON public.call_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u1.team_id = u2.team_id
      WHERE u1.id = auth.uid() 
        AND u2.id = user_id
        AND u1.role IN ('team_lead', 'admin')
    )
  );

-- Policy for managers to view all call logs in their region/department
CREATE POLICY "Managers can view department call logs"
  ON public.call_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u1.department = u2.department
      WHERE u1.id = auth.uid() 
        AND u2.id = user_id
        AND u1.role = 'manager'
    )
  );

-- Create audit table for call log changes
CREATE TABLE IF NOT EXISTS public.call_logs_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id uuid NOT NULL REFERENCES public.call_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on audit table
ALTER TABLE public.call_logs_audit ENABLE ROW LEVEL SECURITY;

-- Audit table policies
CREATE POLICY "Users can view audit logs for accessible call logs"
  ON public.call_logs_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.call_logs cl
      WHERE cl.id = call_log_id
        AND (
          cl.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
          )
        )
    )
  );

-- Function to create audit trail
CREATE OR REPLACE FUNCTION create_call_log_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.call_logs_audit (call_log_id, user_id, action, new_values)
    VALUES (NEW.id, auth.uid(), 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.call_logs_audit (call_log_id, user_id, action, old_values, new_values)
    VALUES (NEW.id, auth.uid(), 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.call_logs_audit (call_log_id, user_id, action, old_values)
    VALUES (OLD.id, auth.uid(), 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers
DROP TRIGGER IF EXISTS call_logs_audit_trigger ON public.call_logs;
CREATE TRIGGER call_logs_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.call_logs
  FOR EACH ROW EXECUTE FUNCTION create_call_log_audit();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_logs_call_status ON public.call_logs(call_status);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_result ON public.call_logs(call_result);
CREATE INDEX IF NOT EXISTS idx_call_logs_updated_at ON public.call_logs(updated_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_audit_call_log_id ON public.call_logs_audit(call_log_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_audit_created_at ON public.call_logs_audit(created_at);

-- Function to check call log permissions
CREATE OR REPLACE FUNCTION check_call_log_permission(call_log_id uuid, required_permission text)
RETURNS boolean AS $$
DECLARE
  user_role text;
  call_user_id uuid;
  lead_assigned_to uuid;
BEGIN
  -- Get current user role
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  
  -- Get call log details
  SELECT cl.user_id, l.assigned_to 
  INTO call_user_id, lead_assigned_to
  FROM public.call_logs cl
  JOIN public.leads l ON cl.lead_id = l.id
  WHERE cl.id = call_log_id;
  
  -- Admin has all permissions
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- User can access their own call logs
  IF call_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- User can access call logs for leads assigned to them
  IF lead_assigned_to = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Team leads can access their team's call logs
  IF user_role = 'team_lead' AND EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.team_id = u2.team_id
    WHERE u1.id = auth.uid() AND u2.id = call_user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Managers can access department call logs
  IF user_role = 'manager' AND EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.department = u2.department
    WHERE u1.id = auth.uid() AND u2.id = call_user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
