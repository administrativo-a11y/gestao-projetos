-- ============================================================
-- GESTÃO v6 — Produtividade da tarefa
-- Subtarefas estendidas, anexos, dependências, start_date, saved_views.
-- Aplicar EM CIMA do v5. Idempotente.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) SUBTAREFAS ESTENDIDAS
-- ============================================================

alter table public.subtasks add column if not exists assignee_id uuid references public.profiles(id) on delete set null;
alter table public.subtasks add column if not exists due_date date;
alter table public.subtasks add column if not exists description text;

-- ============================================================
-- 2) TASKS: start_date para Gantt
-- ============================================================

alter table public.tasks add column if not exists start_date date;

-- ============================================================
-- 3) ANEXOS DE TAREFA
-- ============================================================

create table if not exists public.task_attachments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  file_path text not null,           -- caminho no bucket (space_id/task_id/timestamp-nome)
  file_name text not null,           -- nome original visível
  file_size bigint,
  file_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists task_attachments_task_idx on public.task_attachments(task_id);

-- ============================================================
-- 4) DEPENDÊNCIAS DE TAREFA
-- ============================================================

create table if not exists public.task_dependencies (
  id uuid default uuid_generate_v4() primary key,
  predecessor_id uuid references public.tasks(id) on delete cascade not null,
  successor_id uuid references public.tasks(id) on delete cascade not null,
  type text not null default 'FS' check (type in ('FS','SS','FF','SF')),
  created_at timestamptz default now(),
  unique (predecessor_id, successor_id),
  check (predecessor_id <> successor_id)
);

create index if not exists task_deps_pred_idx on public.task_dependencies(predecessor_id);
create index if not exists task_deps_succ_idx on public.task_dependencies(successor_id);

-- Detecta ciclo na inserção: faz busca recursiva a partir do novo successor
-- e verifica se chega de volta no predecessor.
create or replace function public.check_no_dependency_cycle()
returns trigger as $$
declare
  v_cycle boolean;
begin
  with recursive walk(t) as (
    select new.successor_id
    union all
    select d.successor_id
    from public.task_dependencies d
    join walk on walk.t = d.predecessor_id
  )
  select exists (select 1 from walk where t = new.predecessor_id) into v_cycle;

  if v_cycle then
    raise exception 'Ciclo de dependência detectado';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists task_deps_no_cycle on public.task_dependencies;
create trigger task_deps_no_cycle
  before insert or update on public.task_dependencies
  for each row execute function public.check_no_dependency_cycle();

-- ============================================================
-- 5) VISUALIZAÇÕES SALVAS POR USUÁRIO
-- ============================================================

create table if not exists public.saved_views (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  list_id uuid references public.lists(id) on delete cascade not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, list_id, name)
);

create index if not exists saved_views_user_list_idx on public.saved_views(user_id, list_id);

drop trigger if exists saved_views_updated_at on public.saved_views;
create trigger saved_views_updated_at
  before update on public.saved_views
  for each row execute function public.update_updated_at();

-- ============================================================
-- FIM v6
-- ============================================================
