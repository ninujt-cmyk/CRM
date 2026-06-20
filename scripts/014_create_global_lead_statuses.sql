-- Migration to create global_lead_statuses

CREATE TABLE IF NOT EXISTS global_lead_statuses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    value TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    btn_color TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Allow authenticated users to read global statuses
ALTER TABLE global_lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" 
ON global_lead_statuses FOR SELECT 
TO authenticated 
USING (true);

-- Insert the initial default statuses
INSERT INTO global_lead_statuses (value, label, color, btn_color, icon_name) VALUES
('new', 'New', 'bg-blue-100 text-blue-800', 'bg-blue-600 hover:bg-blue-700', 'Sparkles'),
('contacted', 'Contacted', 'bg-cyan-100 text-cyan-800', 'bg-cyan-600 hover:bg-cyan-700', 'PhoneForwarded'),
('Interested', 'Interested', 'bg-green-100 text-green-800', 'bg-green-600 hover:bg-green-700', 'ThumbsUp'),
('Documents_Sent', 'Docs Pending', 'bg-purple-100 text-purple-800', 'bg-purple-600 hover:bg-purple-700', 'FileText'),
('Login Done', 'Login Done', 'bg-orange-100 text-orange-800', 'bg-orange-600 hover:bg-orange-700', 'LogIn'),
('Transferred to KYC', 'Transferred to KYC', 'bg-indigo-100 text-indigo-800', 'bg-indigo-600 hover:bg-indigo-700', 'CheckCircle2'),
('Underwriting', 'Underwriting', 'bg-yellow-100 text-yellow-800', 'bg-yellow-600 hover:bg-yellow-700', 'FileText'),
('Approved', 'Approved', 'bg-emerald-100 text-emerald-800', 'bg-emerald-600 hover:bg-emerald-700', 'CheckCircle2'),
('Disbursed', 'Disbursed', 'bg-emerald-100 text-emerald-800', 'bg-emerald-600 hover:bg-emerald-700', 'CheckCircle2'),
('Not_Interested', 'Not Interested', 'bg-red-100 text-red-800', 'bg-red-600 hover:bg-red-700', 'ThumbsDown'),
('follow_up', 'Call Back', 'bg-indigo-100 text-indigo-800', 'bg-indigo-600 hover:bg-indigo-700', 'PhoneForwarded'),
('not_eligible', 'Not Eligible', 'bg-rose-100 text-rose-800', 'bg-rose-600 hover:bg-rose-700', 'XCircle'),
('nr', 'NR', 'bg-gray-100 text-gray-800', 'bg-slate-600 hover:bg-slate-700', 'PhoneMissed'),
('self_employed', 'Self Employed', 'bg-amber-100 text-amber-800', 'bg-amber-600 hover:bg-amber-700', 'Briefcase'),
('recycle_pool', 'Recycle Pool', 'bg-gray-200 text-gray-800', 'bg-gray-600 hover:bg-gray-700', 'Recycle')
ON CONFLICT (value) DO NOTHING;
