-- ============================================================
-- ACCOUNTS RECEIVABLE & PAYMENT HISTORY MIGRATION
-- Run this in Supabase SQL Editor to create the missing tables
-- ============================================================

-- Create accounts_receivable table if it doesn't exist
create table if not exists accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  ar_number text unique not null,
  borrower_name text,
  branch_code text,
  amount numeric(15,2) default 0,
  balance numeric(15,2) default 0,
  status text default 'Active',
  due_date date,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ar_status on accounts_receivable(status);
create index if not exists idx_ar_borrower on accounts_receivable(borrower_name);

-- Create accounts_receivable_payment_history table
create table if not exists accounts_receivable_payment_history (
  id uuid primary key default gen_random_uuid(),
  account_receivable_id uuid references accounts_receivable(id) on delete cascade,
  payment_date date,
  amount_paid numeric(15,2) default 0,
  payment_method text,
  reference_no text,
  remarks text,
  encoded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ar_payment_history_ar_id on accounts_receivable_payment_history(ar_id);

-- Enable RLS
alter table accounts_receivable enable row level security;
alter table accounts_receivable_payment_history enable row level security;

-- Create Policies (allow all since auth is custom)
create policy "allow_all_ar" on accounts_receivable for all using (true) with check (true);
create policy "allow_all_ar_payment_history" on accounts_receivable_payment_history for all using (true) with check (true);
