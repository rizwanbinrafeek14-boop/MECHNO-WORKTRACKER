-- Mechno Skill Worktracker — Supabase schema
-- Run this entire file in the Supabase SQL editor of your project.

-- ─── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Profiles (one row per auth user) ──────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'employee')) default 'employee',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Daily work reports ────────────────────────────────────────
create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  report_date date not null default current_date,
  summary text not null,
  quotations_made int not null default 0,
  admin_feedback text,
  created_at timestamptz not null default now(),
  unique (employee_id, report_date)
);

alter table daily_reports add column if not exists admin_feedback text;

-- ─── Suppliers ──────────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sells text not null,
  contact_phone text,
  contact_email text,
  location text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ─── Supplier purchase history ─────────────────────────────────
create table if not exists supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  purchase_date date not null default current_date,
  item_description text not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ─── Quotations ─────────────────────────────────────────────────
create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  customer_name text not null,
  customer_contact text,
  item_description text not null,
  amount numeric(12,2) not null default 0,
  date_sent date not null default current_date,
  status text not null check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  rejection_reason text,
  next_follow_up_date date,
  last_followed_up_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotation_followups (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  employee_id uuid not null references profiles(id),
  followup_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- ─── Purchase orders ────────────────────────────────────────────
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  po_number text,
  customer_name text not null,
  item_description text not null,
  amount numeric(12,2) not null default 0,
  date_received date not null default current_date,
  status text not null check (status in ('received', 'in_progress', 'completed')) default 'received',
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_purchase_orders_updated_at on purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on purchase_orders
for each row execute function set_updated_at();

alter table purchase_orders enable row level security;

create policy "purchase_orders_select" on purchase_orders for select
  using (employee_id = auth.uid() or is_admin());
create policy "purchase_orders_insert" on purchase_orders for insert
  with check (employee_id = auth.uid() or is_admin());
create policy "purchase_orders_update" on purchase_orders for update
  using (employee_id = auth.uid() or is_admin());
create policy "purchase_orders_delete" on purchase_orders for delete
  using (employee_id = auth.uid() or is_admin());

-- ─── Cash flow ──────────────────────────────────────────────────
create table if not exists cash_transactions (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  type text not null check (type in ('inflow', 'outflow', 'expense', 'credit_given', 'credit_taken')),
  category text,
  amount numeric(12,2) not null,
  party_name text,
  description text,
  settled boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ─── updated_at trigger for quotations ─────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_quotations_updated_at on quotations;
create trigger trg_quotations_updated_at
before update on quotations
for each row execute function set_updated_at();

-- ─── Helper: is current user an admin? ─────────────────────────
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ─── Row Level Security ─────────────────────────────────────────
alter table profiles enable row level security;
alter table daily_reports enable row level security;
alter table suppliers enable row level security;
alter table supplier_purchases enable row level security;
alter table quotations enable row level security;
alter table quotation_followups enable row level security;
alter table cash_transactions enable row level security;

-- profiles: users see their own row; admins see all
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_self" on profiles for update
  using (id = auth.uid() or is_admin());
create policy "profiles_insert_admin" on profiles for insert
  with check (is_admin() or id = auth.uid());

-- daily_reports: employees manage their own; admins see/manage all
create policy "daily_reports_select" on daily_reports for select
  using (employee_id = auth.uid() or is_admin());
create policy "daily_reports_insert" on daily_reports for insert
  with check (employee_id = auth.uid() or is_admin());
create policy "daily_reports_update" on daily_reports for update
  using (employee_id = auth.uid() or is_admin());
create policy "daily_reports_delete" on daily_reports for delete
  using (employee_id = auth.uid() or is_admin());

-- quotations: employees manage their own; admins see/manage all
create policy "quotations_select" on quotations for select
  using (employee_id = auth.uid() or is_admin());
create policy "quotations_insert" on quotations for insert
  with check (employee_id = auth.uid() or is_admin());
create policy "quotations_update" on quotations for update
  using (employee_id = auth.uid() or is_admin());
create policy "quotations_delete" on quotations for delete
  using (employee_id = auth.uid() or is_admin());

-- quotation_followups: same pattern
create policy "followups_select" on quotation_followups for select
  using (employee_id = auth.uid() or is_admin());
create policy "followups_insert" on quotation_followups for insert
  with check (employee_id = auth.uid() or is_admin());
create policy "followups_update" on quotation_followups for update
  using (employee_id = auth.uid() or is_admin());
create policy "followups_delete" on quotation_followups for delete
  using (employee_id = auth.uid() or is_admin());

-- suppliers: any logged-in user can view and add; only admins edit/delete
create policy "suppliers_select" on suppliers for select
  using (auth.uid() is not null);
create policy "suppliers_insert" on suppliers for insert
  with check (auth.uid() is not null);
create policy "suppliers_update" on suppliers for update
  using (is_admin());
create policy "suppliers_delete" on suppliers for delete
  using (is_admin());

-- supplier_purchases: any logged-in user can view; only admins manage
create policy "supplier_purchases_select" on supplier_purchases for select
  using (auth.uid() is not null);
create policy "supplier_purchases_insert" on supplier_purchases for insert
  with check (is_admin());
create policy "supplier_purchases_update" on supplier_purchases for update
  using (is_admin());
create policy "supplier_purchases_delete" on supplier_purchases for delete
  using (is_admin());

-- cash_transactions: admin only
create policy "cash_select_admin" on cash_transactions for select
  using (is_admin());
create policy "cash_insert_admin" on cash_transactions for insert
  with check (is_admin());
create policy "cash_update_admin" on cash_transactions for update
  using (is_admin());
create policy "cash_delete_admin" on cash_transactions for delete
  using (is_admin());

-- ─── Auto-create profile on signup ─────────────────────────────
-- search_path is pinned because this trigger fires from the auth schema's
-- internal context, where an unqualified "profiles" reference fails to
-- resolve and silently breaks signup ("Database error creating new user").
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'employee');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
