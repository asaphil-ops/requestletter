-- Compliance - COR and DOLE Certificate
-- Run this in Supabase SQL Editor.

create table if not exists compliance_certificates (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  branch_name text,
  tin text,
  cor_address text,
  cor_link text,
  dole_link text,
  dole_address text,
  cams_address text,
  remarks text,
  uploaded_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table compliance_certificates
  add column if not exists remarks text;

-- Drop unique constraint if it already exists (for existing tables)
ALTER TABLE compliance_certificates DROP CONSTRAINT IF EXISTS compliance_certificates_branch_code_key;

create index if not exists idx_compliance_certificates_branch_code on compliance_certificates(branch_code);
create index if not exists idx_compliance_certificates_branch_name on compliance_certificates(branch_name);

alter table compliance_certificates enable row level security;

drop policy if exists "allow_all_compliance_certificates" on compliance_certificates;
create policy "allow_all_compliance_certificates"
on compliance_certificates
for all
using (true)
with check (true);
