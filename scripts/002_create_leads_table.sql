-- Create leads table for CRM lead management
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null,
  company text,
  designation text,
  source text check (source in ('website', 'referral', 'cold_call', 'social_media', 'advertisement', 'other')) default 'other',
  status text check (status in ('new', 'contacted', 'Interested', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'follow_up')) default 'new',
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  assigned_to uuid references public.users(id) on delete set null,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamp with time zone,
  last_contacted timestamp with time zone,
  next_follow_up timestamp with time zone,
  estimated_value decimal(10,2),
  notes text,
  address text,
  city text,
  state text,
  country text,
  zip_code text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.leads enable row level security;

-- RLS Policies for leads table
create policy "Telecallers can view assigned leads"
  on public.leads for select
  using (
    assigned_to = auth.uid() or
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Telecallers can update assigned leads"
  on public.leads for update
  using (
    assigned_to = auth.uid() or
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert leads"
  on public.leads for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete leads"
  on public.leads for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create updated_at trigger for leads
create trigger leads_updated_at
  before update on public.leads
  for each row
  execute function public.handle_updated_at();

-- Create indexes for better performance
create index idx_leads_assigned_to on public.leads(assigned_to);
create index idx_leads_status on public.leads(status);
create index idx_leads_priority on public.leads(priority);
create index idx_leads_created_at on public.leads(created_at);
create index idx_leads_next_follow_up on public.leads(next_follow_up);
