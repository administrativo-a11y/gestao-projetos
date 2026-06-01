// Edge Function: send-invite-email
//
// Dispara um Magic Link de login pro endereço do convite, com redirect pra
// /invite/<token>. Quando a pessoa clicar no e-mail:
//   1. Supabase Auth valida o link e cria sessão
//   2. Redireciona pra <SITE_URL>/invite/<token>
//   3. Componente Invite.jsx detecta o token + sessão e aceita o convite
//
// Como funciona em termos de e-mail:
//   - Usa supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true } })
//   - O Supabase envia o e-mail usando o template "Magic Link" do projeto
//   - Não precisa SMTP customizado pra começar (Supabase usa SMTP nativo até ~30 e-mails/h no plano grátis)
//
// Segurança:
//   - Recebe o JWT do usuário chamador via Authorization header
//   - Cria um client Supabase com esse JWT — RLS filtra o que ele pode ler
//   - Lê a invitation pelo invitationId; se não tem acesso (não é membro/admin), 404
//   - Confirma que a invitation tem email não vazio
//
// Deploy:
//   supabase functions deploy send-invite-email --no-verify-jwt
//
// (--no-verify-jwt porque a gente faz validação custom via RLS abaixo;
//  o JWT é lido manualmente pra criar o client autenticado)
//
// CORS habilitado pro frontend chamar direto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(init.headers || {}) },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: { invitationId?: string; siteUrl?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid json' }, { status: 400 })
  }

  const { invitationId, siteUrl } = payload
  if (!invitationId) {
    return json({ error: 'invitationId required' }, { status: 400 })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'misconfigured' }, { status: 500 })
  }

  // Client autenticado com o JWT do chamador (respeita RLS)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: invitation, error: invErr } = await userClient
    .from('space_invitations')
    .select('id, email, token, space_id, accepted_at, expires_at')
    .eq('id', invitationId)
    .maybeSingle()

  if (invErr) return json({ error: invErr.message }, { status: 400 })
  if (!invitation) return json({ error: 'invitation não encontrada (ou sem permissão)' }, { status: 404 })
  if (!invitation.email) return json({ error: 'convite sem e-mail definido' }, { status: 400 })
  if (invitation.accepted_at) return json({ error: 'convite já aceito' }, { status: 400 })
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return json({ error: 'convite expirado' }, { status: 400 })
  }

  // Monta a URL de redirect que vai pro componente /invite/<token>
  const baseSite = (siteUrl ?? Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
  if (!baseSite) {
    return json({ error: 'siteUrl não enviado e SITE_URL não configurado' }, { status: 500 })
  }
  const redirectTo = `${baseSite}/invite/${invitation.token}`

  // Dispara o Magic Link via Supabase Auth (usa template "Magic Link" do projeto)
  const { error: otpErr } = await userClient.auth.signInWithOtp({
    email: invitation.email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  })

  if (otpErr) {
    return json({ error: otpErr.message }, { status: 400 })
  }

  return json({ ok: true, email: invitation.email, redirectTo })
})
