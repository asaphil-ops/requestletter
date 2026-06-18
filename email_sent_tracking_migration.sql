-- Email sent tracking for existing databases.
-- Run this once in Supabase SQL Editor.

alter table requests add column if not exists email_sent boolean default false;
alter table requests add column if not exists email_sent_at timestamptz;
alter table requests add column if not exists email_sent_by text;
alter table requests add column if not exists email_subject text;

alter table sbar add column if not exists email_sent boolean default false;
alter table sbar add column if not exists email_sent_at timestamptz;
alter table sbar add column if not exists email_sent_by text;
alter table sbar add column if not exists email_subject text;

alter table it_expenses add column if not exists email_sent boolean default false;
alter table it_expenses add column if not exists email_sent_at timestamptz;
alter table it_expenses add column if not exists email_sent_by text;
alter table it_expenses add column if not exists email_subject text;

alter table at_expenses add column if not exists email_sent boolean default false;
alter table at_expenses add column if not exists email_sent_at timestamptz;
alter table at_expenses add column if not exists email_sent_by text;
alter table at_expenses add column if not exists email_subject text;

alter table comms_expenses add column if not exists email_sent boolean default false;
alter table comms_expenses add column if not exists email_sent_at timestamptz;
alter table comms_expenses add column if not exists email_sent_by text;
alter table comms_expenses add column if not exists email_subject text;

alter table cost_center_initiatives add column if not exists email_sent boolean default false;
alter table cost_center_initiatives add column if not exists email_sent_at timestamptz;
alter table cost_center_initiatives add column if not exists email_sent_by text;
alter table cost_center_initiatives add column if not exists email_subject text;

alter table cost_center_cfoo add column if not exists email_sent boolean default false;
alter table cost_center_cfoo add column if not exists email_sent_at timestamptz;
alter table cost_center_cfoo add column if not exists email_sent_by text;
alter table cost_center_cfoo add column if not exists email_subject text;

alter table cost_center_other add column if not exists email_sent boolean default false;
alter table cost_center_other add column if not exists email_sent_at timestamptz;
alter table cost_center_other add column if not exists email_sent_by text;
alter table cost_center_other add column if not exists email_subject text;
