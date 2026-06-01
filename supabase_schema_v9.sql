-- ============================================================
-- GESTÃO v9 — Notificações in-app
-- Aplicar EM CIMA do v8. Idempotente.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) TABELA
-- ============================================================

create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in (
    'assigned_task','assigned_subtask','commented','status_changed'
  )),
  title text not null,
  body text,
  related_task_id uuid references public.tasks(id) on delete cascade,
  related_actor_id uuid references public.profiles(id) on delete set null,
  read_at timestamptz default null,
  created_at timestamptz default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, read_at, created_at desc);

-- ============================================================
-- 2) HELPER should_notify
-- ============================================================

create or replace function public.should_notify(p_user_id uuid, p_key text)
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    ((select notification_prefs from public.profiles where id = p_user_id) ->> p_key)::boolean,
    true
  );
$$;

-- ============================================================
-- 3) TRIGGERS
-- ============================================================

-- 3.1) task atribuída
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_task_title text;
begin
  v_actor := auth.uid();
  -- ignora auto-atribuição ou quando não há contexto de usuário
  if v_actor is null or v_actor = new.user_id then return new; end if;
  if not public.should_notify(new.user_id, 'assigned') then return new; end if;

  select name into v_actor_name from public.profiles where id = v_actor;
  select title into v_task_title from public.tasks where id = new.task_id;

  insert into public.notifications (
    user_id, type, title, body, related_task_id, related_actor_id
  ) values (
    new.user_id,
    'assigned_task',
    coalesce(v_actor_name, 'Alguém') || ' atribuiu uma tarefa a você',
    v_task_title,
    new.task_id,
    v_actor
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_task_assigned on public.task_assignees;
create trigger trg_notify_task_assigned
  after insert on public.task_assignees
  for each row execute function public.notify_task_assigned();

-- 3.2) subtask atribuída
create or replace function public.notify_subtask_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_task_title text;
  v_parent_task_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then return new; end if;
  if new.assignee_id is null then return new; end if;
  if v_actor = new.assignee_id then return new; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then
    return new;
  end if;
  if not public.should_notify(new.assignee_id, 'assigned') then return new; end if;

  v_parent_task_id := new.task_id;
  select name into v_actor_name from public.profiles where id = v_actor;
  select title into v_task_title from public.tasks where id = v_parent_task_id;

  insert into public.notifications (
    user_id, type, title, body, related_task_id, related_actor_id
  ) values (
    new.assignee_id,
    'assigned_subtask',
    coalesce(v_actor_name, 'Alguém') || ' atribuiu uma subtarefa a você',
    coalesce(v_task_title || ' — ', '') || new.title,
    v_parent_task_id,
    v_actor
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_subtask_assigned on public.subtasks;
create trigger trg_notify_subtask_assigned
  after insert or update of assignee_id on public.subtasks
  for each row execute function public.notify_subtask_assigned();

-- 3.3) comentário adicionado
create or replace function public.notify_comment_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_task record;
  v_recipient uuid;
begin
  select t.title, t.created_by into v_task from public.tasks t where t.id = new.task_id;
  if v_task is null then return new; end if;

  select name into v_actor_name from public.profiles where id = new.user_id;

  -- Conjunto de destinatários: assignees + created_by da tarefa, exceto o autor do comentário
  for v_recipient in
    select distinct ta.user_id
    from public.task_assignees ta
    where ta.task_id = new.task_id
      and ta.user_id <> new.user_id
    union
    select v_task.created_by
    where v_task.created_by is not null
      and v_task.created_by <> new.user_id
  loop
    if public.should_notify(v_recipient, 'commented') then
      insert into public.notifications (
        user_id, type, title, body, related_task_id, related_actor_id
      ) values (
        v_recipient,
        'commented',
        coalesce(v_actor_name, 'Alguém') || ' comentou em uma tarefa',
        coalesce(v_task.title || ': ', '') || substring(new.content from 1 for 140),
        new.task_id,
        new.user_id
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_added on public.comments;
create trigger trg_notify_comment_added
  after insert on public.comments
  for each row execute function public.notify_comment_added();

-- 3.4) mudança de status
create or replace function public.notify_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_old_name text;
  v_new_name text;
  v_recipient uuid;
begin
  if new.status_id is not distinct from old.status_id then return new; end if;
  v_actor := auth.uid();
  if v_actor is null then return new; end if;

  select name into v_actor_name from public.profiles where id = v_actor;
  select name into v_old_name from public.list_statuses where id = old.status_id;
  select name into v_new_name from public.list_statuses where id = new.status_id;

  for v_recipient in
    select ta.user_id
    from public.task_assignees ta
    where ta.task_id = new.id and ta.user_id <> v_actor
  loop
    if public.should_notify(v_recipient, 'status_change') then
      insert into public.notifications (
        user_id, type, title, body, related_task_id, related_actor_id
      ) values (
        v_recipient,
        'status_changed',
        coalesce(v_actor_name, 'Alguém') || ' mudou o status de uma tarefa',
        coalesce(new.title || ': ', '') ||
        coalesce(v_old_name, '?') || ' → ' || coalesce(v_new_name, '?'),
        new.id,
        v_actor
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_status_changed on public.tasks;
create trigger trg_notify_status_changed
  after update of status_id on public.tasks
  for each row execute function public.notify_status_changed();

-- ============================================================
-- 4) RLS
-- ============================================================

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
drop policy if exists notifications_insert on public.notifications;

-- Só o destinatário lê
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Só o destinatário marca como lida / atualiza
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Só o destinatário apaga
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Inserts pelo cliente: bloqueados. Só triggers (security definer) inserem.
create policy notifications_insert on public.notifications for insert to authenticated
  with check (false);

-- ============================================================
-- 5) REALTIME
-- ============================================================

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.notifications';
  exception when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- FIM v9
-- ============================================================
