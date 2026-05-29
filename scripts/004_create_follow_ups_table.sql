-- Create follow_ups table for scheduled follow-up activities
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  follow_up_type text check (follow_up_type in ('call', 'email', 'meeting', 'demo', 'proposal', 'other')) default 'call',
  scheduled_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  status text check (status in ('pending', 'completed', 'cancelled', 'rescheduled')) default 'pending',
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.follow_ups enable row level security;

-- RLS Policies for follow_ups table
create policy "Users can view follow-ups for accessible leads"
  on public.follow_ups for select
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

create policy "Users can insert follow-ups for accessible leads"
  on public.follow_ups for insert
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

create policy "Users can update their own follow-ups"
  on public.follow_ups for update
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete follow-ups"
  on public.follow_ups for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create updated_at trigger for follow_ups
create trigger follow_ups_updated_at
  before update on public.follow_ups
  for each row
  execute function public.handle_updated_at();

-- Create indexes
create index idx_follow_ups_lead_id on public.follow_ups(lead_id);
create index idx_follow_ups_user_id on public.follow_ups(user_id);
create index idx_follow_ups_scheduled_at on public.follow_ups(scheduled_at);
create index idx_follow_ups_status on public.follow_ups(status);
