-- ============================================================
-- GESTÃO v2 — Zera tudo e recria do zero
-- Cole no SQL Editor do Supabase e execute
-- ============================================================

-- Drop tudo na ordem correta (dependências primeiro)
drop table if exists public.comments cascade;
drop table if exists public.task_tags cascade;
drop table if exists public.task_assignees cascade;
drop table if exists public.subtasks cascade;
drop table if exists public.tasks cascade;
drop table if exists public.list_statuses cascade;
drop table if exists public.lists cascade;
drop table if exists public.projects cascade;
drop table if exists public.client_members cascade;
drop table if exists public.clients cascade;
drop table if exists public.workspace_statuses cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.tags cascade;
drop table if exists public.profiles cascade;

-- Drop funções e triggers
drop function if exists public.handle_new_user() cascade;
drop function if exists public.update_updated_at() cascade;
drop function if exists public.add_workspace_owner() cascade;
drop function if exists public.create_default_workspace_statuses() cascade;
drop function if exists public.is_workspace_member(uuid) cascade;
drop function if exists public.is_client_member(uuid) cascade;

-- ============================================================
-- EXTENSÕES
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null unique,
  created_at timestamptz default now()
);

-- Workspaces
create table public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text default '#1D9E75',
  owner_id uuid references public.profiles(id) on delete cascade not null,
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Membros do workspace
create table public.workspace_members (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- Status padrão do workspace (modelo para listas)
create table public.workspace_statuses (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  color text not null default '#888780',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Clientes
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  color text default '#378ADD',
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Membros do cliente (permissões)
create table public.client_members (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member', 'viewer')) default 'member',
  joined_at timestamptz default now(),
  unique(client_id, user_id)
);

-- Projetos
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  color text default '#1D9E75',
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Listas
create table public.lists (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  color text default '#1D9E75',
  deleted_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Status por lista (copiado do workspace ou custom)
create table public.list_statuses (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  name text not null,
  color text not null default '#888780',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Tags (por workspace)
create table public.tags (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  color text default '#1D9E75',
  unique(workspace_id, name)
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

-- Responsáveis por tarefa
create table public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (task_id, user_id)
);

-- Tags por tarefa
create table public.task_tags (
  task_id uuid references public.tasks(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (task_id, tag_id)
);

-- Subtarefas
create table public.subtasks (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  done boolean default false,
  position integer default 0,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

-- Comentários
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

-- updated_at automático
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workspaces_updated_at before update on public.workspaces for each row execute function update_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function update_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function update_updated_at();
create trigger lists_updated_at before update on public.lists for each row execute function update_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function update_updated_at();

-- Cria perfil ao registrar usuário
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Adiciona owner como membro do workspace
create or replace function add_workspace_owner()
returns trigger as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function add_workspace_owner();

-- Cria status padrão ao criar workspace
create or replace function create_default_workspace_statuses()
returns trigger as $$
begin
  insert into public.workspace_statuses (workspace_id, name, color, position) values
    (new.id, 'A fazer',      '#888780', 0),
    (new.id, 'Em andamento', '#378ADD', 1),
    (new.id, 'Em revisão',   '#EF9F27', 2),
    (new.id, 'Concluído',    '#1D9E75', 3);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_workspace_created_statuses
  after insert on public.workspaces
  for each row execute function create_default_workspace_statuses();

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_statuses enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.projects enable row level security;
alter table public.lists enable row level security;
alter table public.list_statuses enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_tags enable row level security;
alter table public.subtasks enable row level security;
alter table public.comments enable row level security;

-- Helpers
create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function is_client_member(p_client_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.client_members
    where client_id = p_client_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Profiles
create policy "profiles_all" on public.profiles for all to authenticated
  using (auth.uid() is not null) with check (id = auth.uid());

-- Workspaces
create policy "workspaces_select" on public.workspaces for select to authenticated
  using (is_workspace_member(id));
create policy "workspaces_insert" on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());
create policy "workspaces_update" on public.workspaces for update to authenticated
  using (owner_id = auth.uid());
create policy "workspaces_delete" on public.workspaces for delete to authenticated
  using (owner_id = auth.uid());

-- Workspace members
create policy "workspace_members_all" on public.workspace_members for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Workspace statuses
create policy "workspace_statuses_all" on public.workspace_statuses for all to authenticated
  using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

-- Clients
create policy "clients_select" on public.clients for select to authenticated
  using (is_workspace_member(workspace_id) and deleted_at is null);
create policy "clients_insert" on public.clients for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "clients_update" on public.clients for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "clients_delete" on public.clients for delete to authenticated
  using (is_workspace_member(workspace_id));

-- Client members
create policy "client_members_all" on public.client_members for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Projects
create policy "projects_select" on public.projects for select to authenticated
  using (
    deleted_at is null and
    exists (
      select 1 from public.clients c
      where c.id = projects.client_id and is_workspace_member(c.workspace_id)
    )
  );
create policy "projects_insert" on public.projects for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = projects.client_id and is_workspace_member(c.workspace_id)
    )
  );
create policy "projects_update" on public.projects for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = projects.client_id and is_workspace_member(c.workspace_id)
    )
  );
create policy "projects_delete" on public.projects for delete to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = projects.client_id and is_workspace_member(c.workspace_id)
    )
  );

-- Lists
create policy "lists_select" on public.lists for select to authenticated
  using (
    deleted_at is null and
    exists (
      select 1 from public.projects p
      join public.clients c on c.id = p.client_id
      where p.id = lists.project_id and is_workspace_member(c.workspace_id)
    )
  );
create policy "lists_insert" on public.lists for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      join public.clients c on c.id = p.client_id
      where p.id = lists.project_id and is_workspace_member(c.workspace_id)
    )
  );
create policy "lists_update" on public.lists for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      join public.clients c on c.id = p.client_id
      where p.id = lists.project_id and is_workspace_member(c.workspace_id)
    )
  );
create policy "lists_delete" on public.lists for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      join public.clients c on c.id = p.client_id
      where p.id = lists.project_id and is_workspace_member(c.workspace_id)
    )
  );

-- List statuses
create policy "list_statuses_all" on public.list_statuses for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Tags
create policy "tags_all" on public.tags for all to authenticated
  using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

-- Tasks
create policy "tasks_all" on public.tasks for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Task assignees, tags, subtasks, comments
create policy "task_assignees_all" on public.task_assignees for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "task_tags_all" on public.task_tags for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "subtasks_all" on public.subtasks for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "comments_all" on public.comments for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
