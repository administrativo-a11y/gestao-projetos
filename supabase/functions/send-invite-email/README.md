# Edge Function: send-invite-email

Dispara um e-mail de Magic Link via Supabase Auth nativo. Quando o destinatário
clica no link, faz login automaticamente e é redirecionado pra
`/invite/<token>` no app, onde o convite é aceito.

## Deploy

### Pré-requisitos

- Supabase CLI instalado (`npm i -g supabase` ou via Scoop/Brew)
- Logado: `supabase login`
- Linkado ao projeto: `supabase link --project-ref <ref-do-projeto>`

(O `<ref-do-projeto>` é a parte antes de `.supabase.co` na URL do projeto.)

### Comandos

Do diretório raiz do repo:

```bash
supabase functions deploy send-invite-email --no-verify-jwt
```

A flag `--no-verify-jwt` é importante: a Edge Function valida o JWT
manualmente (lê o header `Authorization`, cria um client Supabase com esse
JWT, e o RLS filtra o que o usuário pode ver). Sem essa flag o gateway
rejeitaria a chamada antes da função rodar.

## Configurar Redirect URLs no Supabase

Pra que o link no e-mail consiga redirecionar pro app:

1. Abrir o Supabase Dashboard → **Authentication** → **URL Configuration**
2. Em **Redirect URLs**, adicionar:
   - `https://magical-cat-109918.netlify.app/invite/*`
   - `http://localhost:5173/invite/*` (pra dev local, opcional)

Sem isso o Supabase rejeita o `emailRedirectTo`.

## Customizar o template do e-mail (opcional)

1. Authentication → **Email Templates** → **Magic Link**
2. Customizar o assunto e o corpo HTML
3. Variáveis disponíveis:
   - `{{ .ConfirmationURL }}` — link que faz login + redireciona
   - `{{ .Email }}` — e-mail do destinatário
   - `{{ .SiteURL }}` — URL configurada em URL Configuration

Sugestão de assunto: `Você foi convidado para o Gestão de Projetos`

Sugestão de corpo (cole no template):

```html
<h2>Olá,</h2>
<p>Você foi convidado para colaborar no <strong>Gestão de Projetos</strong>.</p>
<p>Clique no botão abaixo pra entrar:</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 20px;background:#1D9E75;color:#fff;
            text-decoration:none;border-radius:6px;font-family:sans-serif;">
    Aceitar convite
  </a>
</p>
<p style="color:#666;font-size:12px;">
  Se você não esperava esse convite, ignore este e-mail.
</p>
```

## Rate limits (importante)

O SMTP nativo do Supabase tem limite de **2 e-mails/hora** no plano Free
e **30/h** no Pro. Pra escalar, configure um SMTP próprio em
Authentication → SMTP Settings (precisa de provedor: SendGrid, Brevo, etc).

## Como testar

1. Abra o app, vá em Configurações do espaço → Membros
2. Coloque um e-mail real e clique "Convidar"
3. Verifica se o feedback verde aparece: "E-mail enviado para X"
4. Verifica o inbox (e SPAM) do destinatário
5. Click no link → app abre logado → tela de aceitar convite

## Troubleshooting

**Feedback amarelo "Convite criado, mas o e-mail não foi enviado":**
- Função não está deployada? Roda `supabase functions deploy send-invite-email`
- Redirect URL não está whitelistada? Confere a config acima
- Bateu no rate limit? Espera 1h ou configura SMTP próprio
- E-mail caiu em SPAM? Pede pro destinatário marcar como "Não é spam"

**Erro "401 unauthorized":**
- Usuário não logado, ou JWT expirado
- Não passou `--no-verify-jwt` no deploy

**Erro "invitation não encontrada":**
- O usuário que chamou a função não tem RLS pra ver essa invitation
- Verifica que ele é membro/admin do espaço
