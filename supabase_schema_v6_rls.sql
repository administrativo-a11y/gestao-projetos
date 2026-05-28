-- ============================================================
-- GESTÃO v6 RLS — policies para tabelas novas e bucket de anexos
-- Aplicar DEPOIS de v6.sql. Usa helpers do v5: can_view_list, can_edit_list,
-- can_edit_task, can_edit_space, is_space_admin.
-- ============================================================

-- ============================================================
-- TASK_ATTACHMENTS
-- ============================================================

alter table public.task_attachments enable row level security;

drop policy if exists task_attachments_select on public.task_attachments;
drop policy if exists task_attachments_insert on public.task_attachments;
drop policy if exists task_attachments_delete on public.task_attachments;

create policy task_attachments_select on public.task_attachments for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_view_list(t.list_id))
  );

create policy task_attachments_insert on public.task_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  );

create policy task_attachments_delete on public.task_attachments for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_space_admin(
      (select l.space_id from public.lists l where l.id = t.list_id)
    ))
  );

-- ============================================================
-- TASK_DEPENDENCIES
-- ============================================================

alter table public.task_dependencies enable row level security;

drop policy if exists task_deps_select on public.task_dependencies;
drop policy if exists task_deps_write on public.task_dependencies;

-- Lê se tem acesso à lista de qualquer um dos lados
create policy task_deps_select on public.task_dependencies for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = predecessor_id and public.can_view_list(t.list_id))
    or exists (select 1 from public.tasks t where t.id = successor_id and public.can_view_list(t.list_id))
  );

-- Escreve se pode editar a tarefa sucessora (lado que "depende de")
create policy task_deps_write on public.task_dependencies for all to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = successor_id and public.can_edit_list(t.list_id))
  )
  with check (
    exists (select 1 from public.tasks t where t.id = successor_id and public.can_edit_list(t.list_id))
  );

-- ============================================================
-- SAVED_VIEWS
-- ============================================================

alter table public.saved_views enable row level security;

drop policy if exists saved_views_select on public.saved_views;
drop policy if exists saved_views_write on public.saved_views;

create policy saved_views_select on public.saved_views for select to authenticated
  using (user_id = auth.uid());

create policy saved_views_write on public.saved_views for all to authenticated
  using (user_id = auth.uid() and public.can_view_list(list_id))
  with check (user_id = auth.uid() and public.can_view_list(list_id));

-- ============================================================
-- BUCKET STORAGE: task-attachments (PRIVADO)
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('task-attachments', 'task-attachments', false)
  on conflict (id) do nothing;

-- Helper: descobre o task_id a partir do path 'space_id/task_id/...'
create or replace function public.task_id_from_path(p_path text)
returns uuid as $$
declare v_tid uuid;
begin
  begin
    v_tid := ((string_to_array(p_path, '/'))[2])::uuid;
  exception when others then
    v_tid := null;
  end;
  return v_tid;
end;
$$ language plpgsql immutable;

drop policy if exists "task_attachments_select_storage" on storage.objects;
drop policy if exists "task_attachments_insert_storage" on storage.objects;
drop policy if exists "task_attachments_delete_storage" on storage.objects;

create policy "task_attachments_select_storage" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.tasks t
      where t.id = public.task_id_from_path(name)
        and public.can_view_list(t.list_id)
    )
  );

create policy "task_attachments_insert_storage" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and owner = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = public.task_id_from_path(name)
        and public.can_edit_list(t.list_id)
    )
  );

create policy "task_attachments_delete_storage" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.tasks t
        join public.lists l on l.id = t.list_id
        where t.id = public.task_id_from_path(name)
          and public.is_space_admin(l.space_id)
      )
    )
  );

-- ============================================================
-- FIM v6 RLS
-- ============================================================
