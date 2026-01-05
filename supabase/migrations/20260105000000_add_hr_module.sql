-- Create HR specific tables

-- HR Employees (Extends public.profiles)
-- We keep sensitive HR data separate from the main profile
create table if not exists public.hr_employees (
    id uuid references auth.users not null primary key,
    joining_date date,
    department text,
    designation text,
    employment_status text check (employment_status in ('active', 'probation', 'terminated', 'resigned')) default 'active',
    reporting_manager_id uuid references auth.users,
    bank_details jsonb, -- { account_number, ifsc, bank_name }
    base_salary numeric,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Leave Types
create table if not exists public.hr_leave_types (
    id uuid default gen_random_uuid() primary key,
    name text not null unique, -- Sick, Casual, Earned
    days_allowed_per_year integer not null default 0,
    is_carry_forward boolean default false,
    color text, -- For UI badging
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Leave Balances
create table if not exists public.hr_leave_balances (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    leave_type_id uuid references public.hr_leave_types not null,
    year integer not null,
    balance numeric not null default 0,
    used numeric not null default 0,
    unique(user_id, leave_type_id, year)
);

-- Leaves
create table if not exists public.hr_leaves (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    leave_type_id uuid references public.hr_leave_types not null,
    start_date date not null,
    end_date date not null,
    days_count numeric not null,
    reason text,
    status text check (status in ('pending', 'approved', 'rejected', 'cancelled')) default 'pending',
    approved_by uuid references auth.users,
    rejection_reason text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Holidays
create table if not exists public.hr_holidays (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    date date not null,
    day_of_week text,
    type text check (type in ('mandatory', 'optional')) default 'mandatory',
    year integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payroll Records
create table if not exists public.hr_payroll_records (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    month integer not null,
    year integer not null,
    base_salary numeric not null,
    additions jsonb, -- Array of { description, amount }
    deductions jsonb, -- Array of { description, amount }
    total_payable numeric not null,
    status text check (status in ('draft', 'processed', 'paid')) default 'draft',
    payment_date date,
    salary_slip_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, month, year)
);

-- RLS Policies

-- Enable RLS
alter table public.hr_employees enable row level security;
alter table public.hr_leave_types enable row level security;
alter table public.hr_leave_balances enable row level security;
alter table public.hr_leaves enable row level security;
alter table public.hr_holidays enable row level security;
alter table public.hr_payroll_records enable row level security;

-- HR Employees Policies
create policy "Users can view their own hr profile"
    on public.hr_employees for select
    using (auth.uid() = id);

create policy "Admins and HR can view all hr profiles"
    on public.hr_employees for select
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Admins and HR can manage hr profiles"
    on public.hr_employees for all
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

-- Leave Types (Read only for users, Manage for Admins)
create policy "Everyone can view leave types"
    on public.hr_leave_types for select
    using (true);

create policy "Admins can manage leave types"
    on public.hr_leave_types for all
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

-- Leave Balances
create policy "Users can view their own leave balances"
    on public.hr_leave_balances for select
    using (auth.uid() = user_id);

create policy "Admins can view all leave balances"
    on public.hr_leave_balances for select
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Admins can manage leave balances"
    on public.hr_leave_balances for all
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

-- Leaves
create policy "Users can view own leaves"
    on public.hr_leaves for select
    using (auth.uid() = user_id);

create policy "Users can insert own leaves"
    on public.hr_leaves for insert
    with check (auth.uid() = user_id);

create policy "Admins can view all leaves"
    on public.hr_leaves for select
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Admins can update leaves"
    on public.hr_leaves for update
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

-- Holidays (Read only for users, Manage for Admins)
create policy "Everyone can view holidays"
    on public.hr_holidays for select
    using (true);

create policy "Admins can manage holidays"
    on public.hr_holidays for all
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

-- Payroll Records (Strictly View for Users, Manage for Admins)
create policy "Users can view own payroll"
    on public.hr_payroll_records for select
    using (auth.uid() = user_id);

create policy "Admins can manage payroll"
    on public.hr_payroll_records for all
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role = 'admin'
        )
    );

-- Initial Data Seeding
insert into public.hr_leave_types (name, days_allowed_per_year, is_carry_forward, color)
values 
('Casual Leave', 12, false, 'blue'),
('Sick Leave', 10, true, 'red'),
('Privilege Leave', 15, true, 'green'),
('Unpaid Leave', 0, false, 'gray');
