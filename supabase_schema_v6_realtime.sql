-- ============================================================
-- GESTÃO v6 — REALTIME
-- Habilita Supabase Realtime nas tabelas relevantes.
-- Rodar uma vez no SQL Editor.
-- ============================================================

-- A publication "supabase_realtime" é criada por padrão no Supabase.
-- Adicionamos as tabelas que queremos que emitam mudanças via canais.

do $$
declare
  t text;
  tables text[] := array[
    'spaces','folders','lists','list_statuses','space_members','space_invitations',
    'tasks','subtasks','task_assignees','task_tags','comments',
    'task_attachments','task_dependencies','saved_views'
  ];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      -- tabela já estava na publication, segue
      null;
    end;
  end loop;
end $$;

-- ============================================================
-- FIM v6 REALTIME
-- ============================================================
