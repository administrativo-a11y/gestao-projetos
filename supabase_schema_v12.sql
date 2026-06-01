-- ============================================================
-- GESTÃO v12 — Tipos de tarefa por espaço
-- Aplicar EM CIMA do v11. Idempotente.
-- ============================================================

-- ============================================================
-- 1) Tabela space_task_types
-- ============================================================

create table if not exists public.space_task_types (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  icon text not null default 'task',
  position integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_space_task_types_space on public.space_task_types(space_id);

-- Apenas um padrão por espaço
create unique index if not exists ux_space_task_types_default
  on public.space_task_types(space_id) where is_default;

-- ============================================================
-- 2) Coluna type_id em tasks
-- ============================================================

alter table public.tasks
  add column if not exists type_id uuid references public.space_task_types(id) on delete set null;

create index if not exists idx_tasks_type on public.tasks(type_id);

-- ============================================================
-- 3) RLS — segue o padrão dos space_statuses
-- ============================================================

alter table public.space_task_types enable row level security;

drop policy if exists space_task_types_select on public.space_task_types;
create policy space_task_types_select on public.space_task_types
  for select using (public.can_view_space(space_id));

drop policy if exists space_task_types_insert on public.space_task_types;
create policy space_task_types_insert on public.space_task_types
  for insert with check (public.is_space_admin(space_id));

drop policy if exists space_task_types_update on public.space_task_types;
create policy space_task_types_update on public.space_task_types
  for update using (public.is_space_admin(space_id)) with check (public.is_space_admin(space_id));

drop policy if exists space_task_types_delete on public.space_task_types;
create policy space_task_types_delete on public.space_task_types
  for delete using (public.is_space_admin(space_id));

-- ============================================================
-- 4) Trigger para criar tipos padrão ao criar um espaço novo
-- ============================================================

create or replace function public.create_default_space_task_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.space_task_types (space_id, name, icon, position, is_default) values
    (new.id, 'Tarefa',         'task',       0, true),
    (new.id, 'Marco',          'milestone',  1, false),
    (new.id, 'Acompanhamento', 'tracking',   2, false),
    (new.id, 'Caminho crítico','critical',   3, false);
  return new;
end $$;

drop trigger if exists trg_default_space_task_types on public.spaces;
create trigger trg_default_space_task_types
  after insert on public.spaces
  for each row execute function public.create_default_space_task_types();

-- ============================================================
-- 5) Backfill: cria tipos padrão pros espaços existentes
-- ============================================================

insert into public.space_task_types (space_id, name, icon, position, is_default)
select s.id, 'Tarefa', 'task', 0, true
from public.spaces s
where not exists (
  select 1 from public.space_task_types t where t.space_id = s.id and t.is_default
);

insert into public.space_task_types (space_id, name, icon, position, is_default)
select s.id, 'Marco', 'milestone', 1, false
from public.spaces s
where not exists (
  select 1 from public.space_task_types t where t.space_id = s.id and t.name = 'Marco'
);

insert into public.space_task_types (space_id, name, icon, position, is_default)
select s.id, 'Acompanhamento', 'tracking', 2, false
from public.spaces s
where not exists (
  select 1 from public.space_task_types t where t.space_id = s.id and t.name = 'Acompanhamento'
);

insert into public.space_task_types (space_id, name, icon, position, is_default)
select s.id, 'Caminho crítico', 'critical', 3, false
from public.spaces s
where not exists (
  select 1 from public.space_task_types t where t.space_id = s.id and t.name = 'Caminho crítico'
);

-- ============================================================
-- 6) Atribui o tipo default às tarefas existentes que ainda não têm type
-- ============================================================

update public.tasks t
set type_id = (
  select tt.id from public.space_task_types tt
  join public.lists l on l.space_id = tt.space_id
  where l.id = t.list_id and tt.is_default
  limit 1
)
where t.type_id is null;

-- ============================================================
-- 7) Realtime
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'space_task_types'
  ) then
    alter publication supabase_realtime add table public.space_task_types;
  end if;
end $$;

-- ============================================================
-- 8) Reload cache PostgREST
-- ============================================================

notify pgrst, 'reload schema';
