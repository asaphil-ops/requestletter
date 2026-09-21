-- Update the saved Aircon & Toilet allocations without changing other module budgets.
insert into public.system_settings (key, value)
values ('module_budgets', '{"at":{"Aircon":16000000,"Toilet":4000000}}')
on conflict (key) do update
set value = jsonb_set(
  jsonb_set(
    coalesce(public.system_settings.value, '{}')::jsonb,
    '{at,Aircon}',
    '16000000'::jsonb,
    true
  ),
  '{at,Toilet}',
  '4000000'::jsonb,
  true
)::text;
