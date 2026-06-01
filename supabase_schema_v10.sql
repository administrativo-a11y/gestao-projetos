-- ============================================================
-- GESTÃO v10 — Posições (ordering) em folders e lists
-- Aplicar EM CIMA do v9. Idempotente.
-- ============================================================

-- ============================================================
-- 1) FOLDERS.position
-- ============================================================

alter table public.folders add column if not exists position integer not null default 0;

do $$
declare v_max int;
begin
  -- Se ninguém ainda usou position (todos 0), faz backfill por created_at
  select coalesce(max(position), 0) into v_max from public.folders;
  if v_max = 0 then
    update public.folders f
    set position = sub.rn - 1
    from (
      select id, row_number() over (partition by space_id order by created_at) as rn
      from public.folders
      where deleted_at is null
    ) sub
    where f.id = sub.id;
  end if;
end $$;

-- ============================================================
-- 2) LISTS.position
-- ============================================================

alter table public.lists add column if not exists position integer not null default 0;

do $$
declare v_max int;
begin
  select coalesce(max(position), 0) into v_max from public.lists;
  if v_max = 0 then
    update public.lists l
    set position = sub.rn - 1
    from (
      select id, row_number() over (
        partition by space_id, coalesce(folder_id::text, 'root')
        order by created_at
      ) as rn
      from public.lists
      where deleted_at is null
    ) sub
    where l.id = sub.id;
  end if;
end $$;

-- ============================================================
-- FIM v10
-- ============================================================
