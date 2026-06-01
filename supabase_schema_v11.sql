-- ============================================================
-- GESTÃO v11 — Descrição da Lista
-- Aplicar EM CIMA do v10. Idempotente.
-- ============================================================

-- ============================================================
-- 1) LISTS.description (texto livre exibido no topo da Lista)
-- ============================================================

alter table public.lists add column if not exists description text;

-- ============================================================
-- 2) Recarrega cache PostgREST pra reconhecer a coluna nova
-- ============================================================

select pg_notify('pgrst', 'reload schema');
