-- ============================================================
-- GESTÃO v8 — Campos Personalizados
-- Aplicar EM CIMA do v7. Idempotente.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) TABELAS
-- ============================================================

create table if not exists public.custom_fields (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  name text not null,
  type text not null check (type in (
    'text','number','date','select','multi_select','user',
    'checkbox','currency','url','email','phone'
  )),
  options jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists custom_fields_list_idx on public.custom_fields(list_id);

drop trigger if exists custom_fields_updated_at on public.custom_fields;
create trigger custom_fields_updated_at
  before update on public.custom_fields
  for each row execute function public.update_updated_at();

create table if not exists public.task_field_values (
  task_id uuid references public.tasks(id) on delete cascade not null,
  field_id uuid references public.custom_fields(id) on delete cascade not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (task_id, field_id)
);

create index if not exists task_field_values_field_idx on public.task_field_values(field_id);

drop trigger if exists task_field_values_updated_at on public.task_field_values;
create trigger task_field_values_updated_at
  before update on public.task_field_values
  for each row execute function public.update_updated_at();

-- ============================================================
-- 2) RLS
-- ============================================================

alter table public.custom_fields enable row level security;
alter table public.task_field_values enable row level security;

drop policy if exists custom_fields_select on public.custom_fields;
drop policy if exists custom_fields_write on public.custom_fields;

create policy custom_fields_select on public.custom_fields for select to authenticated
  using (public.can_view_list(list_id));

create policy custom_fields_write on public.custom_fields for all to authenticated
  using (public.can_edit_list(list_id))
  with check (public.can_edit_list(list_id));

drop policy if exists task_field_values_select on public.task_field_values;
drop policy if exists task_field_values_write on public.task_field_values;

create policy task_field_values_select on public.task_field_values for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_field_values.task_id
        and public.can_view_list(t.list_id)
    )
  );

create policy task_field_values_write on public.task_field_values for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_field_values.task_id
        and public.can_edit_list(t.list_id)
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_field_values.task_id
        and public.can_edit_list(t.list_id)
    )
  );

-- ============================================================
-- 3) REALTIME
-- ============================================================

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.custom_fields';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.task_field_values';
  exception when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- FIM v8
-- ============================================================
