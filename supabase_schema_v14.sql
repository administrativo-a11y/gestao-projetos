-- ============================================================
-- GESTÃO v14 — RPC pra garantir que uma lista tenha status
-- Aplicar EM CIMA do v13. Idempotente.
-- ============================================================

-- ============================================================
-- 1) ensure_list_statuses: copia os status do espaço pra lista
--    se a lista ainda não tem nenhum. Retorna a quantidade criada.
-- ============================================================

create or replace function public.ensure_list_statuses(p_list_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_existing integer;
  v_created integer;
begin
  -- Verifica permissão de edição da lista
  if not public.can_edit_list(p_list_id) then
    raise exception 'permissão negada';
  end if;

  -- Pega o space_id da lista
  select space_id into v_space_id from public.lists where id = p_list_id;
  if v_space_id is null then
    raise exception 'lista não encontrada';
  end if;

  -- Se já tem status, retorna 0 (idempotente)
  select count(*) into v_existing from public.list_statuses where list_id = p_list_id;
  if v_existing > 0 then
    return 0;
  end if;

  -- Copia os status do espaço
  with inserted as (
    insert into public.list_statuses (list_id, name, color, position, category)
    select p_list_id, name, color, position, coalesce(category, 'open')
    from public.space_statuses
    where space_id = v_space_id
    order by position
    returning id
  )
  select count(*) into v_created from inserted;

  return v_created;
end;
$$;

-- ============================================================
-- 2) Backfill imediato: pra cada lista sem status, copia do espaço
-- ============================================================

insert into public.list_statuses (list_id, name, color, position, category)
select l.id, s.name, s.color, s.position, coalesce(s.category, 'open')
from public.lists l
join public.space_statuses s on s.space_id = l.space_id
where l.deleted_at is null
  and not exists (
    select 1 from public.list_statuses ls where ls.list_id = l.id
  );

-- ============================================================
-- 3) Reload cache PostgREST
-- ============================================================

select pg_notify('pgrst', 'reload schema');
