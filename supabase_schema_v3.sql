-- ============================================================
-- GESTÃO v3 — Espaço > Pasta > Lista > Tarefas
-- Cole no SQL Editor do Supabase e execute
-- ============================================================

drop table if exists public.comments cascade;
drop table if exists public.task_tags cascade;
drop table if exists public.task_assignees cascade;
drop table if exists public.subtasks cascade;
drop table if exists public.tasks cascade;
drop table if exists public.list_statuses cascade;
drop table if exists public.lists cascade;
drop table if exists public.folders cascade;
drop table if exists public.space_members cascade;
drop table if exists public.space_statuses cascade;
drop table if exists public.spaces cascade;
drop table if exists public.workspace_statuses cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.client_members cascade;
drop table if exists public.clients cascade;
drop table if exists public.projects cascade;
drop table if exists public.project_members cascade;
drop table if exists public.columns cascade;
drop table if exists public.tags cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.update_updated_at() cascade;
drop function if exists public.add_space_owner() cascade;
drop function if exists public.create_default_space_statuses() cascade;

create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null unique,
  created_at timestamptz default now()
);

-- Espaços (workspace de projetos)
create table public.spaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text default '#1D9E75',
  icon text default 'S',
  owner_id uuid references public.profiles(id) on delete cascade not null,
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Membros do espaço
create table public.space_members (
  id uuid default uuid_generate_v4() primary key,
  space_id uuid references public.spaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member', 'viewer')) default 'member',
  joined_at timestamptz default now(),
  unique(space_id, user_id)
);

-- Status padrão do espaço (modelo para novas listas)
create table public.space_statuses (
  id uuid default uuid_generate_v4() primary key,
  space_id uuid references public.spaces(id) on delete cascade not null,
  name text not null,
  color text not null default '#888780',
  position integer not null default 0
);

-- Pastas (dentro do espaço, opcional)
create table public.folders (
  id uuid default uuid_generate_v4() primary key,
  space_id uuid references public.spaces(id) on delete cascade not null,
  name text not null,
  color text default '#888780',
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Listas (dentro de pasta OU diretamente no espaço)
create table public.lists (
  id uuid default uuid_generate_v4() primary key,
  space_id uuid references public.spaces(id) on delete cascade not null,
  folder_id uuid references public.folders(id) on delete cascade default null,
  name text not null,
  color text default '#1D9E75',
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Status por lista
create table public.list_statuses (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  name text not null,
  color text not null default '#888780',
  position integer not null default 0
);

-- Tags por espaço
create table public.tags (
  id uuid default uuid_generate_v4() primary key,
  space_id uuid references public.spaces(id) on delete cascade not null,
  name text not null,
  color text default '#1D9E75',
  unique(space_id, name)
);

-- Tarefas
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  status_id uuid references public.list_statuses(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  due_date date,
  position integer default 0,
  deleted_at timestamptz default null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (task_id, user_id)
);

create table public.task_tags (
  task_id uuid references public.tasks(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (task_id, tag_id)
);

create table public.subtasks (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  done boolean default false,
  position integer default 0,
  created_at timestamptz default now()
);

create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger spaces_updated_at before update on public.spaces for each row execute function update_updated_at();
create trigger folders_updated_at before update on public.folders for each row execute function update_updated_at();
create trigger lists_updated_at before update on public.lists for each row execute function update_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function update_updated_at();

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function add_space_owner()
returns trigger as $$
begin
  insert into public.space_members (space_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_space_created
  after insert on public.spaces
  for each row execute function add_space_owner();

create or replace function create_default_space_statuses()
returns trigger as $$
begin
  insert into public.space_statuses (space_id, name, color, position) values
    (new.id, 'A fazer',      '#888780', 0),
    (new.id, 'Em andamento', '#378ADD', 1),
    (new.id, 'Em revisão',   '#EF9F27', 2),
    (new.id, 'Concluído',    '#1D9E75', 3);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_space_created_statuses
  after insert on public.spaces
  for each row execute function create_default_space_statuses();

-- ============================================================
-- RLS desabilitado (uso interno)
-- ============================================================

alter table public.profiles disable row level security;
alter table public.spaces disable row level security;
alter table public.space_members disable row level security;
alter table public.space_statuses disable row level security;
alter table public.folders disable row level security;
alter table public.lists disable row level security;
alter table public.list_statuses disable row level security;
alter table public.tags disable row level security;
alter table public.tasks disable row level security;
alter table public.task_assignees disable row level security;
alter table public.task_tags disable row level security;
alter table public.subtasks disable row level security;
alter table public.comments disable row level security;

-- Cria perfil para usuários existentes
insert into public.profiles (id, name, email)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), email
from auth.users
on conflict (id) do nothing;
