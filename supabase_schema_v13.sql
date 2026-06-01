-- ============================================================
-- GESTÃO v13 — Categoria de status (open / closed) + defaults novos
-- Aplicar EM CIMA do v12. Idempotente.
-- ============================================================

-- ============================================================
-- 1) Coluna `category` em space_statuses e list_statuses
-- ============================================================

alter table public.space_statuses
  add column if not exists category text not null default 'open';

alter table public.list_statuses
  add column if not exists category text not null default 'open';

-- Constraint: open ou closed. Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'space_statuses_category_chk'
  ) then
    alter table public.space_statuses
      add constraint space_statuses_category_chk
      check (category in ('open', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'list_statuses_category_chk'
  ) then
    alter table public.list_statuses
      add constraint list_statuses_category_chk
      check (category in ('open', 'closed'));
  end if;
end $$;

-- ============================================================
-- 2) Atualiza trigger pra criar 8 status padrão ao criar espaço novo
-- ============================================================

create or replace function public.create_default_space_statuses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.space_statuses (space_id, name, color, position, category) values
    (new.id, 'TO START',     '#888780', 0, 'open'),
    (new.id, 'EM PROGRESSO', '#378ADD', 1, 'open'),
    (new.id, 'PENDING',      '#E24B4A', 2, 'open'),
    (new.id, 'ON HOLD',      '#EF9F27', 3, 'open'),
    (new.id, 'REVIEW',       '#8B5CF6', 4, 'open'),
    (new.id, 'CANCELED',     '#888780', 5, 'open'),
    (new.id, 'DONE',         '#1D9E75', 6, 'open'),
    (new.id, 'ARCHIVE',      '#1D9E75', 7, 'closed');
  return new;
end;
$$;

-- ============================================================
-- 3) Função pra resetar status de um espaço pros padrões novos
--    (apenas space admin pode chamar; idempotente — apaga e recria)
-- ============================================================

create or replace function public.reset_space_statuses(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_admin(p_space_id) then
    raise exception 'permissão negada';
  end if;

  delete from public.space_statuses where space_id = p_space_id;

  insert into public.space_statuses (space_id, name, color, position, category) values
    (p_space_id, 'TO START',     '#888780', 0, 'open'),
    (p_space_id, 'EM PROGRESSO', '#378ADD', 1, 'open'),
    (p_space_id, 'PENDING',      '#E24B4A', 2, 'open'),
    (p_space_id, 'ON HOLD',      '#EF9F27', 3, 'open'),
    (p_space_id, 'REVIEW',       '#8B5CF6', 4, 'open'),
    (p_space_id, 'CANCELED',     '#888780', 5, 'open'),
    (p_space_id, 'DONE',         '#1D9E75', 6, 'open'),
    (p_space_id, 'ARCHIVE',      '#1D9E75', 7, 'closed');
end;
$$;

-- ============================================================
-- 4) Função pra limpar duplicatas "Novo status" sem confirmar usuário
--    (espacos existentes podem ter virado bagunça)
-- ============================================================

create or replace function public.cleanup_novo_status(p_space_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_space_admin(p_space_id) then
    raise exception 'permissão negada';
  end if;

  with deleted as (
    delete from public.space_statuses
    where space_id = p_space_id
      and lower(trim(name)) = 'novo status'
    returning id
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

-- ============================================================
-- 5) Reload cache PostgREST
-- ============================================================

select pg_notify('pgrst', 'reload schema');
