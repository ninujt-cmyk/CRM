-- Create attendance tables

-- Create attendance table
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  scheduled_check_in timestamp with time zone,
  scheduled_check_out timestamp with time zone,
  total_hours text,
  overtime_hours text,
  break_hours text,
  status text not null check (status in ('present', 'absent', 'late', 'half-day', 'leave', 'holiday')) default 'absent',
  location_check_in jsonb,
  location_check_out jsonb,
  ip_check_in text,
  ip_check_out text,
  device_info_check_in text,
  device_info_check_out text,
  notes text,
  approved_by uuid references public.users(id),
  approved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- Create breaks table
create table if not exists public.breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  break_type text not null check (break_type in ('lunch', 'tea', 'personal', 'other')),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  duration_minutes integer,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create leaves table
create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type text not null check (leave_type in ('paid', 'unpaid', 'sick', 'casual', 'maternity', 'paternity')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  approved_by uuid references public.users(id),
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create holidays table
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  type text not null check (type in ('public', 'company')),
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create attendance_settings table
create table if not exists public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  office_location jsonb,
  allowed_ips text[],
  work_hours_start text, -- HH:MM format
  work_hours_end text, -- HH:MM format
  lunch_break_duration integer default 60, -- minutes
  auto_checkout_enabled boolean default false,
  auto_checkout_time text, -- HH:MM format
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create attendance_adjustments table (for audit trail)
create table if not exists public.attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  adjusted_by uuid not null references public.users(id),
  reason text not null,
  previous_data jsonb not null,
  new_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.attendance enable row level security;
alter table public.breaks enable row level security;
alter table public.leaves enable row level security;
alter table public.holidays enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.attendance_adjustments enable row level security;

-- RLS Policies for attendance table
create policy "Users can view their own attendance"
  on public.attendance for select
  using (auth.uid() = user_id);

create policy "Admins can view all attendance"
  on public.attendance for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert their own attendance"
  on public.attendance for insert
  with check (auth.uid() = user_id);

create policy "Admins can insert attendance"
  on public.attendance for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can update their own attendance"
  on public.attendance for update
  using (auth.uid() = user_id);

create policy "Admins can update attendance"
  on public.attendance for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for breaks table
create policy "Users can view their own breaks"
  on public.breaks for select
  using (auth.uid() = user_id);

create policy "Admins can view all breaks"
  on public.breaks for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert their own breaks"
  on public.breaks for insert
  with check (auth.uid() = user_id);

create policy "Admins can insert breaks"
  on public.breaks for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can update their own breaks"
  on public.breaks for update
  using (auth.uid() = user_id);

create policy "Admins can update breaks"
  on public.breaks for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for leaves table
create policy "Users can view their own leaves"
  on public.leaves for select
  using (auth.uid() = user_id);

create policy "Admins can view all leaves"
  on public.leaves for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert their own leaves"
  on public.leaves for insert
  with check (auth.uid() = user_id);

create policy "Admins can update leaves status"
  on public.leaves for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for holidays table
create policy "Users can view holidays"
  on public.holidays for select
  using (true);

create policy "Admins can manage holidays"
  on public.holidays for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for attendance_settings table
create policy "Users can view attendance settings"
  on public.attendance_settings for select
  using (true);

create policy "Admins can manage attendance settings"
  on public.attendance_settings for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for attendance_adjustments table
create policy "Users can view adjustments for their attendance"
  on public.attendance_adjustments for select
  using (
    exists (
      select 1 from public.attendance a
      where a.id = attendance_id and a.user_id = auth.uid()
    )
  );

create policy "Admins can view all adjustments"
  on public.attendance_adjustments for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert adjustments"
  on public.attendance_adjustments for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create updated_at triggers
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger attendance_updated_at
  before update on public.attendance
  for each row
  execute function public.handle_updated_at();

create trigger breaks_updated_at
  before update on public.breaks
  for each row
  execute function public.handle_updated_at();

create trigger leaves_updated_at
  before update on public.leaves
  for each row
  execute function public.handle_updated_at();

create trigger holidays_updated_at
  before update on public.holidays
  for each row
  execute function public.handle_updated_at();

create trigger attendance_settings_updated_at
  before update on public.attendance_settings
  for each row
  execute function public.handle_updated_at();

-- Create indexes for better performance
create index if not exists idx_attendance_user_id on public.attendance(user_id);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_attendance_status on public.attendance(status);
create index if not exists idx_breaks_user_id on public.breaks(user_id);
create index if not exists idx_breaks_date on public.breaks(date);
create index if not exists idx_leaves_user_id on public.leaves(user_id);
create index if not exists idx_leaves_date on public.leaves(start_date, end_date);
create index if not exists idx_leaves_status on public.leaves(status);
create index if not exists idx_holidays_date on public.holidays(date);
create index if not exists idx_attendance_adjustments_attendance_id on public.attendance_adjustments(attendance_id);
create index if not exists idx_attendance_adjustments_adjusted_by on public.attendance_adjustments(adjusted_by);