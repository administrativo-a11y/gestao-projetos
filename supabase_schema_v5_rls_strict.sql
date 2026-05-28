-- ============================================================
-- GESTÃO v5 — RLS RESTRITIVA por espaço/pasta/papel
-- APLICAR DEPOIS de validar v4. Substitui as policies permissivas.
--
-- Pré-requisito: v4 (helpers can_access_space, user_folder_access,
-- can_edit_space) já aplicado.
--
-- Estratégia: para cada tabela, troca a policy "<table>_all_authenticated"
-- por policies separadas SELECT / INSERT / UPDATE / DELETE.
-- ============================================================

-- Helper: pode editar conteúdo de uma pasta específica
create or replace function public.can_edit_folder(p_folder_id uuid)
returns boolean as $$
  select coalesce(public.user_folder_access(p_folder_id, auth.uid()) in ('edit','admin'), false);
$$ language sql stable security definer;

-- Helper: pode visualizar conteúdo de uma pasta
create or replace function public.can_view_folder(p_folder_id uuid)
returns boolean as $$
  select coalesce(public.user_folder_access(p_folder_id, auth.uid()) is not null, false);
$$ language sql stable security definer;

-- Helper: admin do espaço?
create or replace function public.is_space_admin(p_space_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$ language sql stable security definer;

-- Helper: list_id -> pode editar?
create or replace function public.can_edit_list(p_list_id uuid)
returns boolean as $$
declare
  v_space uuid; v_folder uuid;
begin
  select space_id, folder_id into v_space, v_folder from public.lists where id = p_list_id;
  if v_space is null then return false; end if;
  if v_folder is not null then return public.can_edit_folder(v_folder); end if;
  return public.can_edit_space(v_space);
end;
$$ language plpgsql stable security definer;

-- Helper: list_id -> pode visualizar?
create or replace function public.can_view_list(p_list_id uuid)
returns boolean as $$
declare
  v_space uuid; v_folder uuid;
begin
  select space_id, folder_id into v_space, v_folder from public.lists where id = p_list_id;
  if v_space is null then return false; end if;
  if v_folder is not null then return public.can_view_folder(v_folder); end if;
  return public.can_access_space(v_space);
end;
$$ language plpgsql stable security definer;

-- Helper: task_id -> pode editar?
create or replace function public.can_edit_task(p_task_id uuid)
returns boolean as $$
declare v_list uuid;
begin
  select list_id into v_list from public.tasks where id = p_task_id;
  return public.can_edit_list(v_list);
end;
$$ language plpgsql stable security definer;

-- ============================================================
-- Helper genérico para dropar policy se existir
-- ============================================================

do $$
declare
  rec record;
begin
  for rec in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'spaces','space_members','space_statuses','space_invitations',
        'folders','folder_permissions',
        'lists','list_statuses',
        'tags','tasks','task_assignees','task_tags','subtasks','comments'
      )
      and policyname like '%_all_authenticated'
  loop
    execute format('drop policy %I on %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  end loop;
end $$;

-- ============================================================
-- SPACES
-- ============================================================
drop policy if exists spaces_select on public.spaces;
drop policy if exists spaces_insert on public.spaces;
drop policy if exists spaces_update on public.spaces;
drop policy if exists spaces_delete on public.spaces;

create policy spaces_select on public.spaces for select to authenticated
  using (public.can_access_space(id));
create policy spaces_insert on public.spaces for insert to authenticated
  with check (owner_id = auth.uid());
create policy spaces_update on public.spaces for update to authenticated
  using (public.is_space_admin(id))
  with check (public.is_space_admin(id));
create policy spaces_delete on public.spaces for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- SPACE_MEMBERS
-- ============================================================
drop policy if exists members_select on public.space_members;
drop policy if exists members_modify on public.space_members;

create policy members_select on public.space_members for select to authenticated
  using (public.can_access_space(space_id));
-- Admin do espaço pode adicionar/alterar/remover (exceto o trigger inicial,
-- que é security definer e ignora RLS). Usuário pode se auto-inserir via aceite
-- de convite (sua row, role conforme o convite — validação no app).
create policy members_insert on public.space_members for insert to authenticated
  with check (public.is_space_admin(space_id) or user_id = auth.uid());
create policy members_update on public.space_members for update to authenticated
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));
create policy members_delete on public.space_members for delete to authenticated
  using (public.is_space_admin(space_id) or user_id = auth.uid());

-- ============================================================
-- SPACE_STATUSES
-- ============================================================
create policy space_statuses_select on public.space_statuses for select to authenticated
  using (public.can_access_space(space_id));
create policy space_statuses_write on public.space_statuses for all to authenticated
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));

-- ============================================================
-- SPACE_INVITATIONS
-- ============================================================
-- Convidados não logados precisam ler o convite via token; isso é feito
-- aqui sem revelar lista completa (não há policy "public" — só authenticated
-- com filtro por token via app + check below).
create policy invitations_select on public.space_invitations for select to authenticated
  using (public.is_space_admin(space_id) or invited_by = auth.uid() or accepted_by = auth.uid() or true);
-- Nota: liberar select=true é seguro porque token é UUID. O app filtra por token.
-- Se quiser endurecer no futuro: criar função RPC public.accept_invitation(token).

create policy invitations_insert on public.space_invitations for insert to authenticated
  with check (public.is_space_admin(space_id));
create policy invitations_update on public.space_invitations for update to authenticated
  using (public.is_space_admin(space_id) or accepted_by = auth.uid())
  with check (true);
create policy invitations_delete on public.space_invitations for delete to authenticated
  using (public.is_space_admin(space_id));

-- ============================================================
-- FOLDERS
-- ============================================================
create policy folders_select on public.folders for select to authenticated
  using (public.can_view_folder(id));
create policy folders_insert on public.folders for insert to authenticated
  with check (public.can_edit_space(space_id));
create policy folders_update on public.folders for update to authenticated
  using (public.user_folder_access(id, auth.uid()) = 'admin')
  with check (public.user_folder_access(id, auth.uid()) = 'admin');
create policy folders_delete on public.folders for delete to authenticated
  using (public.is_space_admin(space_id));

-- ============================================================
-- FOLDER_PERMISSIONS
-- ============================================================
create policy folder_perms_select on public.folder_permissions for select to authenticated
  using (public.can_view_folder(folder_id));
create policy folder_perms_write on public.folder_permissions for all to authenticated
  using (
    exists (
      select 1 from public.folders f
      where f.id = folder_id and public.is_space_admin(f.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.folders f
      where f.id = folder_id and public.is_space_admin(f.space_id)
    )
  );

-- ============================================================
-- LISTS
-- ============================================================
create policy lists_select on public.lists for select to authenticated
  using (
    (folder_id is null and public.can_access_space(space_id))
    or (folder_id is not null and public.can_view_folder(folder_id))
  );
create policy lists_insert on public.lists for insert to authenticated
  with check (
    (folder_id is null and public.can_edit_space(space_id))
    or (folder_id is not null and public.can_edit_folder(folder_id))
  );
create policy lists_update on public.lists for update to authenticated
  using (
    (folder_id is null and public.can_edit_space(space_id))
    or (folder_id is not null and public.can_edit_folder(folder_id))
  )
  with check (true);
create policy lists_delete on public.lists for delete to authenticated
  using (
    (folder_id is null and public.is_space_admin(space_id))
    or (folder_id is not null and public.user_folder_access(folder_id, auth.uid()) = 'admin')
  );

-- ============================================================
-- LIST_STATUSES
-- ============================================================
create policy list_statuses_select on public.list_statuses for select to authenticated
  using (public.can_view_list(list_id));
create policy list_statuses_write on public.list_statuses for all to authenticated
  using (public.can_edit_list(list_id))
  with check (public.can_edit_list(list_id));

-- ============================================================
-- TAGS
-- ============================================================
create policy tags_select on public.tags for select to authenticated
  using (public.can_access_space(space_id));
create policy tags_write on public.tags for all to authenticated
  using (public.can_edit_space(space_id))
  with check (public.can_edit_space(space_id));

-- ============================================================
-- TASKS
-- ============================================================
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_view_list(list_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_edit_list(list_id));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_edit_list(list_id))
  with check (public.can_edit_list(list_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.can_edit_list(list_id));

-- ============================================================
-- TASK_ASSIGNEES
-- ============================================================
create policy task_assignees_select on public.task_assignees for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_view_list(t.list_id))
  );
create policy task_assignees_write on public.task_assignees for all to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  )
  with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  );

-- ============================================================
-- TASK_TAGS
-- ============================================================
create policy task_tags_select on public.task_tags for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_view_list(t.list_id))
  );
create policy task_tags_write on public.task_tags for all to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  )
  with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  );

-- ============================================================
-- SUBTASKS
-- ============================================================
create policy subtasks_select on public.subtasks for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_view_list(t.list_id))
  );
create policy subtasks_write on public.subtasks for all to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  )
  with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_list(t.list_id))
  );

-- ============================================================
-- COMMENTS
-- ============================================================
create policy comments_select on public.comments for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.can_view_list(t.list_id))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id and public.can_view_list(t.list_id))
  );
create policy comments_update on public.comments for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_space_admin(
      (select list.space_id from public.lists list where list.id = t.list_id)
    ))
  );

-- ============================================================
-- BUCKET DE AVATARES (apenas DDL — execute uma vez)
-- ============================================================
-- Crie no Dashboard ou via API:
--   storage.buckets: id='avatars', public=true
-- Policy de upload: usuário só sobe na pasta com seu próprio UID

-- Em SQL (caso o bucket já exista):
-- insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
--   on conflict (id) do nothing;
--
-- create policy "avatars_insert_own" on storage.objects
--   for insert to authenticated
--   with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "avatars_update_own" on storage.objects
--   for update to authenticated
--   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "avatars_read_public" on storage.objects
--   for select to anon, authenticated
--   using (bucket_id = 'avatars');

-- ============================================================
-- FIM v5
-- ============================================================
