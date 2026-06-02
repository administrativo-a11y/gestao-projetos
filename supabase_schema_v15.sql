-- ============================================================
-- GESTÃO v15 — Aplicar status do espaço numa lista existente
-- Aplicar EM CIMA do v14. Idempotente.
-- ============================================================

-- ============================================================
-- 1) RPC apply_space_statuses_to_list
--
--    Substitui os list_statuses da lista pelos space_statuses
--    atuais do espaço.
--
--    Tarefas existentes ficam com status_id = NULL (porque o FK é
--    on delete set null). O frontend trata isso mostrando essas
--    tarefas em um grupo "Sem status".
--
--    Retorna a quantidade de status criados.
--
--    Security: apenas quem pode editar a lista (helper can_edit_list
--    do v5_rls_strict).
-- ============================================================

create or replace function public.apply_space_statuses_to_list(p_list_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_created integer;
begin
  if not public.can_edit_list(p_list_id) then
    raise exception 'permissão negada';
  end if;

  select space_id into v_space_id from public.lists where id = p_list_id;
  if v_space_id is null then
    raise exception 'lista não encontrada';
  end if;

  -- Apaga os list_statuses atuais (tasks viram status_id null pelo FK on delete set null)
  delete from public.list_statuses where list_id = p_list_id;

  -- Copia os space_statuses atuais
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
-- 2) Reload cache PostgREST
-- ============================================================

select pg_notify('pgrst', 'reload schema');
