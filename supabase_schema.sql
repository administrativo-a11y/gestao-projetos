-- ============================================================
-- GESTÃO DE PROJETOS — Schema Supabase
-- Cole este arquivo inteiro no SQL Editor do Supabase
-- ============================================================

-- Extensão para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis de usuário (complementa auth.users do Supabase)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  avatar_initials text generated always as (upper(left(name, 1))) stored,
  created_at timestamptz default now()
);

-- Projetos
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  color text default '#1D9E75',
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Membros de projeto (quem tem acesso ao quê)
create table public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'member', 'viewer')) default 'member',
  joined_at timestamptz default now(),
  unique(project_id, user_id)
);

-- Colunas de status por projeto (customizável)
create table public.columns (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  color text default '#888780',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Tarefas
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  column_id uuid references public.columns(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  due_date date,
  position integer default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Responsáveis por tarefa (pode ter múltiplos)
create table public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (task_id, user_id)
);

-- Tags
create table public.tags (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  color text default '#1D9E75',
  unique(project_id, name)
);

-- Tags por tarefa
create table public.task_tags (
  task_id uuid references public.tasks(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (task_id, tag_id)
);

-- Comentários
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Subtarefas
create table public.subtasks (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  done boolean default false,
  position integer default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function update_updated_at();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();

-- ============================================================
-- TRIGGER: cria perfil automaticamente ao registrar usuário
-- ============================================================

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

-- ============================================================
-- TRIGGER: adiciona owner como membro ao criar projeto
-- ============================================================

create or replace function add_owner_as_member()
returns trigger as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created
  after insert on public.projects
  for each row execute function add_owner_as_member();

-- ============================================================
-- TRIGGER: cria colunas padrão ao criar projeto
-- ============================================================

create or replace function create_default_columns()
returns trigger as $$
begin
  insert into public.columns (project_id, name, color, position) values
    (new.id, 'A fazer',      '#888780', 0),
    (new.id, 'Em andamento', '#378ADD', 1),
    (new.id, 'Em revisão',   '#EF9F27', 2),
    (new.id, 'Concluído',    '#1D9E75', 3);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created_columns
  after insert on public.projects
  for each row execute function create_default_columns();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuário só vê dados dos projetos em que é membro
-- ============================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.comments enable row level security;
alter table public.subtasks enable row level security;

-- Helper: verifica se o usuário é membro do projeto
create or replace function is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
    and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- profiles: usuário vê o próprio perfil e perfis de colegas de projeto
create policy "profiles_select" on public.profiles for select
  using (
    id = auth.uid() or
    exists (
      select 1 from public.project_members pm1
      join public.project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid() and pm2.user_id = profiles.id
    )
  );
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid());

-- projects
create policy "projects_select" on public.projects for select
  using (is_project_member(id));
create policy "projects_insert" on public.projects for insert
  with check (owner_id = auth.uid());
create policy "projects_update" on public.projects for update
  using (owner_id = auth.uid());
create policy "projects_delete" on public.projects for delete
  using (owner_id = auth.uid());

-- project_members
create policy "members_select" on public.project_members for select
  using (is_project_member(project_id));
create policy "members_insert" on public.project_members for insert
  with check (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );
create policy "members_delete" on public.project_members for delete
  using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

-- columns
create policy "columns_select" on public.columns for select
  using (is_project_member(project_id));
create policy "columns_insert" on public.columns for insert
  with check (is_project_member(project_id));
create policy "columns_update" on public.columns for update
  using (is_project_member(project_id));
create policy "columns_delete" on public.columns for delete
  using (is_project_member(project_id));

-- tasks
create policy "tasks_select" on public.tasks for select
  using (is_project_member(project_id));
create policy "tasks_insert" on public.tasks for insert
  with check (is_project_member(project_id));
create policy "tasks_update" on public.tasks for update
  using (is_project_member(project_id));
create policy "tasks_delete" on public.tasks for delete
  using (is_project_member(project_id));

-- task_assignees
create policy "assignees_select" on public.task_assignees for select
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "assignees_insert" on public.task_assignees for insert
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "assignees_delete" on public.task_assignees for delete
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));

-- tags
create policy "tags_select" on public.tags for select
  using (is_project_member(project_id));
create policy "tags_insert" on public.tags for insert
  with check (is_project_member(project_id));
create policy "tags_delete" on public.tags for delete
  using (is_project_member(project_id));

-- task_tags
create policy "task_tags_select" on public.task_tags for select
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "task_tags_insert" on public.task_tags for insert
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "task_tags_delete" on public.task_tags for delete
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));

-- comments
create policy "comments_select" on public.comments for select
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "comments_insert" on public.comments for insert
  with check (
    user_id = auth.uid() and
    exists (select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id))
  );
create policy "comments_delete" on public.comments for delete
  using (user_id = auth.uid());

-- subtasks
create policy "subtasks_select" on public.subtasks for select
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "subtasks_insert" on public.subtasks for insert
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "subtasks_update" on public.subtasks for update
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
create policy "subtasks_delete" on public.subtasks for delete
  using (exists (
    select 1 from public.tasks t where t.id = task_id and is_project_member(t.project_id)
  ));
