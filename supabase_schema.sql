-- ============================================================
-- OPS FINANCE PORTAL - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ACCOUNTS (custom auth, not Supabase Auth)
-- ============================================================
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  role text not null default 'Staff',
  full_name text,
  email text,
  photo_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- BRANCHES
-- ============================================================
create table if not exists branches (
  code text primary key,
  name text,
  area text,
  region text,
  division text,
  operation text,
  email text,
  created_at timestamptz default now()
);

-- ============================================================
-- STAFF
-- ============================================================
create table if not exists staff (
  id text primary key,
  last_name text,
  first_name text,
  position text,
  email text,
  branch_code text references branches(code) on delete set null,
  branch_name text,
  area text,
  region text,
  division text,
  operation text,
  created_at timestamptz default now()
);

create index if not exists idx_staff_branch on staff(branch_code);
create index if not exists idx_staff_operation on staff(operation);
create index if not exists idx_staff_region on staff(region);

-- ============================================================
-- REQUESTS
-- ============================================================
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  req_id text unique not null,
  type text default 'Staff Request',
  beneficiary text,
  date_req date,
  title text,
  description text,
  amount numeric(15,2) default 0,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_date on requests(date_req);
create index if not exists idx_requests_created on requests(created_at desc);

-- ============================================================
-- SBAR / BUDGET TRANSFER
-- ============================================================
create table if not exists sbar (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  type text default 'SBAR',
  date date,
  giver_branch_code text references branches(code) on delete set null,
  receiver_branch_code text references branches(code) on delete set null,
  giver_title text,
  receiver_title text,
  description text,
  amount numeric(15,2) default 0,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sbar_status on sbar(status);
create index if not exists idx_sbar_date on sbar(date);

-- ============================================================
-- IT EXPENSES
-- ============================================================
create table if not exists it_expenses (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  category text,
  date date,
  branch_code text,
  branch_name text,
  account_title text,
  item_name text,
  description text,
  amount numeric(15,2) default 0,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_it_status on it_expenses(status);
create index if not exists idx_it_branch on it_expenses(branch_code);
create index if not exists idx_it_category on it_expenses(category);

-- ============================================================
-- AT EXPENSES (Aircon & Toilet)
-- ============================================================
create table if not exists at_expenses (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  category text,
  date date,
  branch_code text,
  branch_name text,
  account_title text,
  item_name text,
  description text,
  amount numeric(15,2) default 0,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_at_status on at_expenses(status);
create index if not exists idx_at_branch on at_expenses(branch_code);

-- ============================================================
-- COMMS EXPENSES
-- ============================================================
create table if not exists comms_expenses (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  category text,
  date date,
  branch_code text,
  branch_name text,
  account_title text,
  item_name text,
  description text,
  amount numeric(15,2) default 0,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_comms_status on comms_expenses(status);
create index if not exists idx_comms_branch on comms_expenses(branch_code);
create index if not exists idx_comms_category on comms_expenses(category);

-- ============================================================
-- COST CENTER - INITIATIVES MONTHLY EXPENSES
-- ============================================================
create table if not exists cost_center_initiatives (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  date date,
  id_number text,
  staff_name text,
  designation text,
  particular text,
  sub_account text,
  account_title text,
  amount numeric(15,2) default 0,
  transaction_type text,
  remarks text,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cost_center_initiatives_date on cost_center_initiatives(date);
create index if not exists idx_cost_center_initiatives_id_number on cost_center_initiatives(id_number);
create index if not exists idx_cost_center_initiatives_staff_name on cost_center_initiatives(staff_name);
create index if not exists idx_cost_center_initiatives_particular on cost_center_initiatives(particular);
create index if not exists idx_cost_center_initiatives_sub_account on cost_center_initiatives(sub_account);
create index if not exists idx_cost_center_initiatives_account on cost_center_initiatives(account_title);
create index if not exists idx_cost_center_initiatives_status on cost_center_initiatives(status);

-- ============================================================
-- DATA MANAGEMENT - INITIATIVE ACCOUNT MAPPING
-- ============================================================
create table if not exists initiative_account_mappings (
  id uuid primary key default gen_random_uuid(),
  particular text not null,
  sub_account text not null,
  account_title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(particular, sub_account)
);

create index if not exists idx_initiative_account_mappings_particular on initiative_account_mappings(particular);
create index if not exists idx_initiative_account_mappings_sub_account on initiative_account_mappings(sub_account);

-- ============================================================
-- EMPLOYEE LIST
-- ============================================================
create table if not exists employee_list (
  id uuid primary key default gen_random_uuid(),
  id_number text unique not null,
  full_name text not null,
  designation text,
  contact_number text,
  email_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_employee_list_full_name on employee_list(full_name);
create index if not exists idx_employee_list_designation on employee_list(designation);

-- ============================================================
-- COST CENTER - CFOO PER STAFF MONTHLY EXPENSE
-- ============================================================
create table if not exists cost_center_cfoo (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  date date,
  id_number text,
  staff_name text,
  designation text,
  account_title text,
  amount numeric(15,2) default 0,
  transaction_type text,
  remarks text,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cost_center_cfoo_date on cost_center_cfoo(date);
create index if not exists idx_cost_center_cfoo_staff on cost_center_cfoo(staff_name);
create index if not exists idx_cost_center_cfoo_id_number on cost_center_cfoo(id_number);
create index if not exists idx_cost_center_cfoo_status on cost_center_cfoo(status);

-- ============================================================
-- COST CENTER - OTHER MONTHLY EXPENSES
-- ============================================================
create table if not exists cost_center_other (
  id uuid primary key default gen_random_uuid(),
  uniq_id text unique not null,
  date date,
  account_title text,
  cost_center text,
  amount numeric(15,2) default 0,
  remarks text,
  status text default 'Pending',
  file_id text,
  uploader text,
  uploader_info text,
  ops_info text,
  fin_info text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cost_center_other_date on cost_center_other(date);
create index if not exists idx_cost_center_other_account on cost_center_other(account_title);
create index if not exists idx_cost_center_other_center on cost_center_other(cost_center);
create index if not exists idx_cost_center_other_status on cost_center_other(status);

-- ============================================================
-- CFOO BUDGET PLAN
-- ============================================================
-- Drop existing view if it exists to allow table creation
drop view if exists cfoo_budget;

create table if not exists cfoo_budget (
  id uuid primary key default gen_random_uuid(),
  id_number text not null,
  staff_name text,
  initiative text,
  account_title text not null,
  operation text,
  division text,
  region text,
  area text,
  budget numeric(15,2) default 0,
  transfer_to_field_ops numeric(15,2) default 0,
  sbar numeric(15,2) default 0,
  actual numeric(15,2) default 0,
  remaining_budget numeric(15,2) default 0,
  month text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(id_number, account_title, month)
);

create index if not exists idx_cfoo_budget_id_number on cfoo_budget(id_number);
create index if not exists idx_cfoo_budget_month on cfoo_budget(month);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  action text,
  details text,
  created_at timestamptz default now()
);

create index if not exists idx_logs_created on audit_logs(created_at desc);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
create table if not exists system_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

insert into system_settings (key, value) values
  ('maintenance_mode', 'false'),
  ('req_titles', '["Personnel Costs","Trainings","Transportation","Supplies","Rent","Utilities","Communication","Meetings","Taxes","Repairs","Insurance","IT Expenses","Representation","Miscellaneous"]')
on conflict (key) do nothing;

-- ============================================================
-- EMAIL LOGS
-- ============================================================
create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  sent_by text,
  to_addresses text,
  cc_addresses text,
  subject text,
  ref_type text,
  ref_id text,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS POLICIES (Row Level Security)
-- Enable for all tables but allow all for anon key
-- (since you're using custom auth, not Supabase Auth)
-- ============================================================
alter table accounts enable row level security;
alter table branches enable row level security;
alter table staff enable row level security;
alter table requests enable row level security;
alter table sbar enable row level security;
alter table it_expenses enable row level security;
alter table at_expenses enable row level security;
alter table comms_expenses enable row level security;
alter table cost_center_initiatives enable row level security;
alter table cost_center_cfoo enable row level security;
alter table cost_center_other enable row level security;
alter table cfoo_budget enable row level security;
alter table initiative_account_mappings enable row level security;
alter table employee_list enable row level security;
alter table audit_logs enable row level security;
alter table system_settings enable row level security;
alter table email_logs enable row level security;

-- Allow all operations for anon key (your app handles auth)
create policy "allow_all_accounts" on accounts for all using (true) with check (true);
create policy "allow_all_branches" on branches for all using (true) with check (true);
create policy "allow_all_staff" on staff for all using (true) with check (true);
create policy "allow_all_requests" on requests for all using (true) with check (true);
create policy "allow_all_sbar" on sbar for all using (true) with check (true);
create policy "allow_all_it" on it_expenses for all using (true) with check (true);
create policy "allow_all_at" on at_expenses for all using (true) with check (true);
create policy "allow_all_comms" on comms_expenses for all using (true) with check (true);
create policy "allow_all_cost_center_initiatives" on cost_center_initiatives for all using (true) with check (true);
create policy "allow_all_cost_center_cfoo" on cost_center_cfoo for all using (true) with check (true);
create policy "allow_all_cost_center_other" on cost_center_other for all using (true) with check (true);
create policy "allow_all_cfoo_budget" on cfoo_budget for all using (true) with check (true);
create policy "allow_all_initiative_account_mappings" on initiative_account_mappings for all using (true) with check (true);
create policy "allow_all_employee_list" on employee_list for all using (true) with check (true);
create policy "allow_all_logs" on audit_logs for all using (true) with check (true);
create policy "allow_all_settings" on system_settings for all using (true) with check (true);
create policy "allow_all_email_logs" on email_logs for all using (true) with check (true);

-- ============================================================
-- SEED DEFAULT ADMIN ACCOUNT
-- password: admin123 (change after first login)
-- ============================================================
insert into accounts (username, password, role, full_name, email)
values ('admin', 'admin123', 'Super Admin', 'System Admin', 'admin@asaphil.org')
on conflict (username) do nothing;
