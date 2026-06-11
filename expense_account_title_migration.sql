alter table if exists it_expenses
  add column if not exists account_title text;

alter table if exists at_expenses
  add column if not exists account_title text;

alter table if exists comms_expenses
  add column if not exists account_title text;

update comms_expenses
set account_title = 'Supplies'
where account_title is null
   or trim(account_title) = '';

update it_expenses
set account_title = 'Supplies'
where account_title is null
   or trim(account_title) = '';

update at_expenses
set account_title = 'Supplies'
where account_title is null
   or trim(account_title) = '';

create index if not exists idx_it_account_title on it_expenses(account_title);
create index if not exists idx_at_account_title on at_expenses(account_title);
create index if not exists idx_comms_account_title on comms_expenses(account_title);
