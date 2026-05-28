-- ============================================================
-- GESTÃO v4 — Fundamentos: perfil estendido, convites, permissões por pasta, RLS
-- Aplicar EM CIMA do v3. Idempotente (pode rodar várias vezes).
-- Cole no SQL Editor do Supabase e execute.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto; -- para gen_random_bytes / digest se preciso

-- ============================================================
-- 1) PERFIL ESTENDIDO
-- ============================================================

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists theme_preference text default 'system'
  check (theme_preference in ('light','dark','system'));
alter table public.profiles add column if not exists notification_prefs jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists updated_at timestamptz default now();

create or replace function public.update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ============================================================
-- 2) CONVITES DE ESPAÇO
-- ============================================================

create table if not exists public.space_invitations (
  id uuid default uuid_generate_v4() primary key,
  space_id uuid references public.spaces(id) on delete cascade not null,
  email text,
  role text check (role in ('admin','member','viewer')) default 'member',
  token text not null unique default replace(uuid_generate_v4()::text, '-', ''),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz default null,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists space_invitations_space_idx on public.space_invitations(space_id);
create index if not exists space_invitations_token_idx on public.space_invitations(token);

-- ============================================================
-- 3) PERMISSÕES POR PASTA
-- ============================================================

create table if not exists public.folder_permissions (
  id uuid default uuid_generate_v4() primary key,
  folder_id uuid references public.folders(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('owner','admin','member','viewer')),
  permission text not null check (permission in ('view','edit','admin')),
  created_at timestamptz default now(),
  check (
    (user_id is not null and role is null) or
    (user_id is null and role is not null)
  ),
  unique (folder_id, user_id, role)
);

create index if not exists folder_permissions_folder_idx on public.folder_permissions(folder_id);
create index if not exists folder_permissions_user_idx on public.folder_permissions(user_id);

-- ============================================================
-- 4) HELPERS DE PERMISSÃO
-- ============================================================

-- Retorna o papel do usuário no espaço, ou null se não for membro
create or replace function public.user_space_role(p_space_id uuid, p_user_id uuid)
returns text as $$
  select role from public.space_members
  where space_id = p_space_id and user_id = p_user_id
  limit 1;
$$ language sql stable security definer;

-- Rank numérico para comparar permissões: admin=3, edit=2, view=1
create or replace function public.perm_rank(p text)
returns int as $$
  select case p when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end;
$$ language sql immutable;

-- Retorna nível efetivo de acesso à pasta: 'admin' > 'edit' > 'view' > null
create or replace function public.user_folder_access(p_folder_id uuid, p_user_id uuid)
returns text as $$
declare
  v_space_id uuid;
  v_role text;
  v_explicit text;
  v_by_role text;
  v_best int;
begin
  select space_id into v_space_id from public.folders where id = p_folder_id;
  if v_space_id is null then return null; end if;

  select role into v_role from public.space_members
    where space_id = v_space_id and user_id = p_user_id;
  if v_role is null then return null; end if;

  -- Owner/admin do espaço sempre admin na pasta
  if v_role in ('owner','admin') then return 'admin'; end if;

  -- Maior permissão explícita por usuário
  select permission into v_explicit from public.folder_permissions
    where folder_id = p_folder_id and user_id = p_user_id
    order by public.perm_rank(permission) desc
    limit 1;

  -- Maior permissão pelo papel
  select permission into v_by_role from public.folder_permissions
    where folder_id = p_folder_id and role = v_role
    order by public.perm_rank(permission) desc
    limit 1;

  -- Se há alguma regra (usuário OU papel), usa o maior dos dois
  if v_explicit is not null or v_by_role is not null then
    v_best := greatest(public.perm_rank(v_explicit), public.perm_rank(v_by_role));
    return case v_best when 3 then 'admin' when 2 then 'edit' else 'view' end;
  end if;

  -- Sem regra: herda do papel no espaço (member = edit, viewer = view)
  return case v_role when 'member' then 'edit' when 'viewer' then 'view' else 'view' end;
end;
$$ language plpgsql stable security definer;

-- Pode acessar o espaço (qualquer nível)?
create or replace function public.can_access_space(p_space_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$ language sql stable security definer;

-- Pode editar conteúdo do espaço (admin/member, ignora permissões de pasta)?
create or replace function public.can_edit_space(p_space_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
      and role in ('owner','admin','member')
  );
$$ language sql stable security definer;

-- ============================================================
-- 5) RLS — habilitar com policies PERMISSIVAS (using true)
-- Validar que tudo continua funcionando, depois restringir.
-- ============================================================

-- profiles: leitura aberta (precisa para mostrar nomes de assignees/membros);
-- escrita só no próprio registro
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- Demais tabelas: enable RLS + policy permissiva como degrau de transição
do $$
declare
  t text;
  tables text[] := array[
    'spaces','space_members','space_statuses','space_invitations',
    'folders','folder_permissions',
    'lists','list_statuses',
    'tags','tasks','task_assignees','task_tags','subtasks','comments'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_all_authenticated', t
    );
  end loop;
end $$;

-- ============================================================
-- 6) BACKFILL: adiciona dono a space_members se faltar
-- (defesa para espaços antigos criados antes do trigger v3)
-- ============================================================

insert into public.space_members (space_id, user_id, role)
select s.id, s.owner_id, 'owner'
from public.spaces s
where not exists (
  select 1 from public.space_members m
  where m.space_id = s.id and m.user_id = s.owner_id
)
on conflict do nothing;

-- ============================================================
-- FIM. Próximo passo (em uma migração futura): substituir as policies
-- permissivas por restritivas usando can_access_space / user_folder_access.
-- ============================================================
