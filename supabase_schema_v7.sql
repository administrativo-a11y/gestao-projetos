-- ============================================================
-- GESTÃO v7 — Organização: arquivar e duplicar
-- - archived_at em folders/lists
-- - duplicate_list(p_list_id) e duplicate_folder(p_folder_id)
-- Aplicar EM CIMA do v6. Idempotente.
-- ============================================================

-- ============================================================
-- 1) ARCHIVED_AT
-- ============================================================

alter table public.lists   add column if not exists archived_at timestamptz default null;
alter table public.folders add column if not exists archived_at timestamptz default null;

-- ============================================================
-- 2) FUNÇÃO INTERNA: duplicar uma lista PARA uma pasta-alvo (ou root)
-- ============================================================

create or replace function public._duplicate_list_internal(
  p_list_id uuid,
  p_target_folder_id uuid,
  p_name_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src record;
  v_new_list_id uuid;
begin
  select * into v_src from public.lists where id = p_list_id and deleted_at is null;
  if v_src.id is null then
    raise exception 'Lista não encontrada';
  end if;

  insert into public.lists (space_id, folder_id, name, color)
  values (
    v_src.space_id,
    p_target_folder_id,
    coalesce(p_name_prefix, '') || v_src.name,
    v_src.color
  )
  returning id into v_new_list_id;

  -- list_statuses: insert + retorna map (old, new) numa CTE; salva em temp table
  create temp table if not exists _status_map (old_id uuid, new_id uuid) on commit drop;
  delete from _status_map;
  insert into _status_map (old_id, new_id)
  select s.id as old_id, gen_random_uuid() as new_id
  from public.list_statuses s
  where s.list_id = p_list_id;

  insert into public.list_statuses (id, list_id, name, color, position)
  select m.new_id, v_new_list_id, s.name, s.color, s.position
  from public.list_statuses s
  join _status_map m on m.old_id = s.id
  where s.list_id = p_list_id;

  -- tasks: map old_task_id → new_task_id
  create temp table if not exists _task_map (old_id uuid, new_id uuid) on commit drop;
  delete from _task_map;
  insert into _task_map (old_id, new_id)
  select t.id, gen_random_uuid()
  from public.tasks t
  where t.list_id = p_list_id and t.deleted_at is null;

  insert into public.tasks (
    id, list_id, status_id, title, description, priority,
    start_date, due_date, position, created_by, created_at, updated_at
  )
  select
    tm.new_id,
    v_new_list_id,
    sm.new_id,  -- status_id remapeado
    t.title, t.description, t.priority,
    t.start_date, t.due_date, t.position,
    auth.uid(),  -- new creator
    now(), now()
  from public.tasks t
  join _task_map tm on tm.old_id = t.id
  left join _status_map sm on sm.old_id = t.status_id
  where t.list_id = p_list_id and t.deleted_at is null;

  -- subtasks
  insert into public.subtasks (task_id, title, done, position, assignee_id, due_date, description)
  select tm.new_id, s.title, false, s.position, s.assignee_id, s.due_date, s.description
  from public.subtasks s
  join _task_map tm on tm.old_id = s.task_id;

  -- task_assignees
  insert into public.task_assignees (task_id, user_id)
  select tm.new_id, ta.user_id
  from public.task_assignees ta
  join _task_map tm on tm.old_id = ta.task_id
  on conflict do nothing;

  -- task_tags
  insert into public.task_tags (task_id, tag_id)
  select tm.new_id, tt.tag_id
  from public.task_tags tt
  join _task_map tm on tm.old_id = tt.task_id
  on conflict do nothing;

  -- NÃO copiamos: task_attachments, comments, task_dependencies (intencional).
  return v_new_list_id;
end;
$$;

revoke all on function public._duplicate_list_internal(uuid, uuid, text) from public;

-- ============================================================
-- 3) duplicate_list — checa permissão e duplica para a mesma pasta
-- ============================================================

create or replace function public.duplicate_list(p_list_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folder_id uuid;
  v_new_id uuid;
begin
  if not public.can_edit_list(p_list_id) then
    raise exception 'Sem permissão para duplicar esta lista';
  end if;

  select folder_id into v_folder_id from public.lists where id = p_list_id;
  v_new_id := public._duplicate_list_internal(p_list_id, v_folder_id, 'Cópia de ');
  return v_new_id;
end;
$$;

grant execute on function public.duplicate_list(uuid) to authenticated;

-- ============================================================
-- 4) duplicate_folder — checa permissão e duplica pasta + listas dentro
-- ============================================================

create or replace function public.duplicate_folder(p_folder_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src record;
  v_new_folder_id uuid;
  v_list record;
begin
  select * into v_src from public.folders where id = p_folder_id and deleted_at is null;
  if v_src.id is null then
    raise exception 'Pasta não encontrada';
  end if;

  if not (public.is_space_admin(v_src.space_id)
          or public.user_folder_access(p_folder_id, auth.uid()) = 'admin') then
    raise exception 'Sem permissão para duplicar esta pasta';
  end if;

  insert into public.folders (space_id, name, color)
  values (v_src.space_id, 'Cópia de ' || v_src.name, v_src.color)
  returning id into v_new_folder_id;

  for v_list in
    select id from public.lists
    where folder_id = p_folder_id
      and deleted_at is null
      and archived_at is null
  loop
    perform public._duplicate_list_internal(v_list.id, v_new_folder_id, null);
  end loop;

  return v_new_folder_id;
end;
$$;

grant execute on function public.duplicate_folder(uuid) to authenticated;

-- ============================================================
-- FIM v7
-- ============================================================
