-- Create notes table for lead notes and comments
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  note_type text check (note_type in ('general', 'call', 'meeting', 'email', 'follow_up')) default 'general',
  is_important boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notes enable row level security;

-- RLS Policies for notes table
create policy "Users can view notes for accessible leads"
  on public.notes for select
  using (
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

create policy "Users can insert notes for accessible leads"
  on public.notes for insert
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

create policy "Users can update their own notes"
  on public.notes for update
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete notes"
  on public.notes for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create updated_at trigger for notes
create trigger notes_updated_at
  before update on public.notes
  for each row
  execute function public.handle_updated_at();

-- Create indexes
create index idx_notes_lead_id on public.notes(lead_id);
create index idx_notes_user_id on public.notes(user_id);
create index idx_notes_created_at on public.notes(created_at);
