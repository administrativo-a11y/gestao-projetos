// Release notes — ordem decrescente (mais recente no topo).
// Categorias: 'feat' (verde), 'fix' (laranja), 'chore' (cinza).

export const RELEASES = [
  {
    version: '1.9.0',
    date: '2026-05-29',
    title: 'Polimento de UI',
    items: [
      { type: 'feat', text: 'Biblioteca de ícones SVG centralizada (estilo Lucide) — substitui os emojis no painel de colunas' },
      { type: 'feat', text: 'Switch (toggle) maior e com animação mais suave' },
      { type: 'chore', text: 'Sombras com tons mais quentes e gradação melhor' },
      { type: 'chore', text: 'Bordas e fundos dos ícones do painel mais consistentes' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-05-29',
    title: 'Arrastar pastas e listas na sidebar',
    items: [
      { type: 'feat', text: 'Reordenar pastas arrastando na sidebar' },
      { type: 'feat', text: 'Reordenar listas dentro de uma pasta arrastando' },
      { type: 'feat', text: 'Reordenar listas soltas (sem pasta) arrastando' },
      { type: 'feat', text: 'Schema v10: coluna position em folders/lists com backfill por data de criação' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-05-29',
    title: 'Comentários, Anexos e painel de colunas',
    items: [
      { type: 'feat', text: 'Coluna "Últimos comentários" na Lista — vê preview do último comentário sem abrir a tarefa' },
      { type: 'feat', text: 'Coluna "Anexos" na Lista — badge com contagem de arquivos anexados' },
      { type: 'feat', text: 'Botão "Colunas" abre painel deslizante à direita (estilo ClickUp)' },
      { type: 'feat', text: 'Aba "Criar novo" lista todos os tipos de campo personalizado' },
      { type: 'feat', text: 'Aba "Adicionar existente" com toggle de visibilidade Mostrado/Oculto por coluna' },
      { type: 'feat', text: 'Excluir campo personalizado direto pelo painel' },
      { type: 'feat', text: 'Busca de campos dentro do painel' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-29',
    title: 'Lista mais flexível',
    items: [
      { type: 'feat', text: 'Reordenar colunas da Lista arrastando os cabeçalhos (persistido por usuário)' },
      { type: 'feat', text: 'Agrupar por Responsável (tarefas com múltiplos aparecem em cada grupo)' },
      { type: 'feat', text: 'Botão "Sem responsável" como grupo separado quando agrupando por pessoa' },
      { type: 'feat', text: 'Cada grupo agora tem chevron para colapsar/expandir (estado persistido)' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-29',
    title: 'Notificações in-app',
    items: [
      { type: 'feat', text: 'Sino de notificações no topbar com badge de não lidas' },
      { type: 'feat', text: 'Notifica quando você é atribuído a tarefas e subtarefas' },
      { type: 'feat', text: 'Notifica quando comentam em suas tarefas' },
      { type: 'feat', text: 'Notifica quando alguém muda o status das suas tarefas' },
      { type: 'feat', text: 'Click na notificação abre a tarefa direto via deep-link' },
      { type: 'feat', text: 'Realtime — notificações chegam sem F5' },
      { type: 'feat', text: 'Respeita suas preferências (Perfil → Notificações no app)' },
      { type: 'feat', text: 'Histórico de releases (esse modal!) no rodapé do sidebar' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-28',
    title: 'Campos personalizados + correções',
    items: [
      { type: 'feat', text: 'Campos personalizados por lista (11 tipos: texto, número, data, seleção, múltipla seleção, pessoa, checkbox, valor R$, URL, e-mail, telefone)' },
      { type: 'feat', text: 'Engrenagem ⚙ ao lado do nome da lista abre Configurações da lista' },
      { type: 'feat', text: 'Renomear espaço/pasta/lista inline (⋯ → Renomear, ou click no nome no topbar)' },
      { type: 'fix', text: 'Modal de criação mostra erro quando RLS bloqueia (antes fechava em silêncio)' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-27',
    title: 'Organização (Fase 3a) + UX ClickUp + busca global',
    items: [
      { type: 'feat', text: 'Status por espaço editáveis pela UI (drag-drop, paleta de cores)' },
      { type: 'feat', text: 'Duplicar lista/pasta (copia tarefas, subtarefas, responsáveis, tags)' },
      { type: 'feat', text: 'Arquivar lista/pasta + toggle "Mostrar arquivados"' },
      { type: 'feat', text: 'Memória de view por lista (Board/Lista/Gantt/Painel) em localStorage' },
      { type: 'feat', text: 'Sidebar redimensionável (drag no edge direito) + colapsável com peek-on-hover' },
      { type: 'feat', text: 'Busca global Ctrl+K (tarefas, listas, pastas, espaços)' },
      { type: 'feat', text: 'Ações ⋯/+ hover-reveladas em espaço/pasta/lista' },
      { type: 'feat', text: 'Ações ✓/📋/⋯ hover-reveladas no card de tarefa (Board, Lista, Gantt)' },
      { type: 'feat', text: 'Deep-link ?task=ID — copiar link abre a tarefa direto' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-27',
    title: 'Produtividade da tarefa (Fase 2) + realtime',
    items: [
      { type: 'feat', text: 'Responsáveis por tarefa (UI multi-select reusável)' },
      { type: 'feat', text: 'Subtarefas estendidas: responsável, prazo e descrição' },
      { type: 'feat', text: 'Anexos em tarefas com signed URLs (60s)' },
      { type: 'feat', text: 'Dependências entre tarefas (FS — Término → Início)' },
      { type: 'feat', text: 'Nova view Gantt com barras, zoom dia/semana/mês e linhas de dependência' },
      { type: 'feat', text: 'Filtros completos: status, prioridade, responsável, prazo, atrasadas' },
      { type: 'feat', text: 'Visualizações salvas por usuário' },
      { type: 'feat', text: 'Realtime via Supabase Channels — sem mais F5 pra ver mudanças' },
      { type: 'feat', text: 'Memória do último espaço/lista usado em localStorage' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-26',
    title: 'Fundamentos (Fase 1)',
    items: [
      { type: 'feat', text: 'Perfil de usuário com upload de avatar' },
      { type: 'feat', text: 'Gestão de membros do espaço + convites por link' },
      { type: 'feat', text: 'Permissões por pasta com RLS estrita no Supabase' },
      { type: 'feat', text: 'Tema claro/escuro/sistema com persistência' },
      { type: 'feat', text: 'Rotas compartilháveis (/space/:id/list/:id)' },
      { type: 'feat', text: 'Recuperação de senha por e-mail' },
      { type: 'feat', text: 'Mostrar/esconder senha no login' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-25',
    title: 'MVP inicial',
    items: [
      { type: 'feat', text: 'Hierarquia Espaço → Pasta → Lista → Tarefa' },
      { type: 'feat', text: 'Kanban com drag-drop' },
      { type: 'feat', text: 'Tarefas com status, prioridade, prazo, subtarefas, comentários, tags' },
      { type: 'feat', text: 'Autenticação via e-mail/senha (Supabase Auth)' },
      { type: 'feat', text: 'Soft delete com toast de "Desfazer"' },
    ],
  },
]

export const CURRENT_VERSION = RELEASES[0]?.version ?? '0.0.0'
