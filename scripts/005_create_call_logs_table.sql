-- Create call_logs table for tracking call activities
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  call_type text check (call_type in ('outbound', 'inbound')) not null,
  call_status text check (call_status in ('connected', 'no_answer', 'busy', 'voicemail', 'failed')) not null,
  duration_seconds integer default 0,
  notes text,
  follow_up_required boolean default false,
  next_call_scheduled timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.call_logs enable row level security;

-- RLS Policies for call_logs table
create policy "Users can view call logs for accessible leads"
  on public.call_logs for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.leads l
      where l.id = lead_id and (
        l.assigned_to = auth.uid() or
        exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
    )
  );

create policy "Users can insert call logs for accessible leads"
  on public.call_logs for insert
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.leads l
      where l.id = lead_id and (
        l.assigned_to = auth.uid() or
        exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
    )
  );

create policy "Users can update their own call logs"
  on public.call_logs for update
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete call logs"
  on public.call_logs for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create indexes
create index idx_call_logs_lead_id on public.call_logs(lead_id);
create index idx_call_logs_user_id on public.call_logs(user_id);
create index idx_call_logs_created_at on public.call_logs(created_at);
create index idx_call_logs_call_status on public.call_logs(call_status);
