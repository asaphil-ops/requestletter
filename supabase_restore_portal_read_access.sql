-- Restores read and write access for the portal's custom-login client.
-- Run once in Supabase Dashboard > SQL Editor.
-- This changes policies only; it does not modify or delete records.
--
-- The current app uses a custom accounts-table login rather than Supabase Auth.
-- Therefore its browser requests use the anon database role. A future migration to
-- Supabase Auth should replace these broad access policies with role-based policies.

do $$
declare
  table_name text;
  tables text[] := array[
    'accounts',
    'branches',
    'staff',
    'requests',
    'sbar',
    'it_expenses',
    'at_expenses',
    'generator_expenses',
    'comms_expenses',
    'cost_center_initiatives',
    'cost_center_cfoo',
    'cost_center_other',
    'compliance_certificates',
    'cfoo_budget',
    'initiative_account_mappings',
    'employee_list',
    'audit_logs',
    'system_settings',
    'email_logs'
  ];
begin
  foreach table_name in array tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format(
        'drop policy if exists %I on public.%I',
        'portal_read_' || table_name,
        table_name
      );
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        'portal_read_' || table_name,
        table_name
      );
      execute format(
        'drop policy if exists %I on public.%I',
        'portal_insert_' || table_name,
        table_name
      );
      execute format(
        'create policy %I on public.%I for insert to anon, authenticated with check (true)',
        'portal_insert_' || table_name,
        table_name
      );
      execute format(
        'drop policy if exists %I on public.%I',
        'portal_update_' || table_name,
        table_name
      );
      execute format(
        'create policy %I on public.%I for update to anon, authenticated using (true) with check (true)',
        'portal_update_' || table_name,
        table_name
      );
      execute format(
        'drop policy if exists %I on public.%I',
        'portal_delete_' || table_name,
        table_name
      );
      execute format(
        'create policy %I on public.%I for delete to anon, authenticated using (true)',
        'portal_delete_' || table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Verify the policies were created:
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and policyname like 'portal_%_%'
order by tablename, policyname;
