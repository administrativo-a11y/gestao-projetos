-- ============================================================
-- PATCH v4 — permite que usuários ANÔNIMOS consultem um convite
-- pelo token (sem expor a listagem completa).
--
-- Rode no SQL Editor depois do v4.
-- ============================================================

create or replace function public.get_invitation_by_token(p_token text)
returns table (
  id uuid,
  space_id uuid,
  space_name text,
  space_color text,
  role text,
  email text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    i.id, i.space_id, s.name as space_name, s.color as space_color,
    i.role, i.email, i.expires_at, i.accepted_at
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  where i.token = p_token
  limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
