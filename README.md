# Gestão de Projetos

Ferramenta interna de gerenciamento de projetos com Board, Lista e Dashboard.

---

## 1. Supabase — banco de dados

1. Acesse https://supabase.com e abra seu projeto
2. Vá em **SQL Editor** e cole todo o conteúdo do arquivo `supabase_schema.sql`
3. Execute. Isso vai criar as tabelas, políticas RLS, triggers e funções.

Depois, vá em **Settings > API** e anote:
- **Project URL** (ex: https://xyzxyz.supabase.co)
- **anon public key**

---

## 2. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

---

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:5173

---

## 4. Deploy no Netlify

### Opção A — via interface (mais simples)

1. Faça push do projeto para um repositório GitHub
2. Acesse https://app.netlify.com > **Add new site > Import from Git**
3. Selecione o repositório
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Vá em **Site settings > Environment variables** e adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Redeploy

### Opção B — via CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set VITE_SUPABASE_URL https://SEU-PROJETO.supabase.co
netlify env:set VITE_SUPABASE_ANON_KEY sua_anon_key
netlify deploy --prod
```

---

## 5. Adicionar membros da equipe

1. Cada membro cria sua conta em /auth (email + senha)
2. O dono do projeto vai no Supabase > Table Editor > project_members e insere manualmente o user_id do novo membro

> Em breve: fluxo de convite por e-mail direto na interface

---

## Estrutura do projeto

```
src/
  components/
    auth/          — tela de login/cadastro
    board/         — kanban com drag-and-drop
    list/          — view de lista/tabela
    dashboard/     — métricas e progresso
    shared/        — sidebar, topbar, modais
  hooks/
    useAuth.jsx    — autenticação
    useProjects.jsx — CRUD de projetos
    useTasks.jsx   — CRUD de tarefas e colunas
  lib/
    supabase.js    — cliente Supabase
  pages/
    Auth.jsx       — página de login
    App.jsx        — layout principal
  styles/
    global.css     — design system e variáveis
```

---

## Fases futuras

- Fase 2: Timeline/Gantt
- Fase 3: Importação via CSV do ClickUp
- Fase 4: Notificações e convite de membros por e-mail
- Fase 5: Campos customizados
