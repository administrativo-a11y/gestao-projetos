# Checklist de QA — Gestão de Projetos

Roteiro de teste manual para validar todas as funcionalidades antes de cada release significativa. Versão coberta: **v1.9.0**.

## Como usar

1. Tenha 2 contas em mãos (`A` = owner / admin do espaço, `B` = membro convidado). Se você só tem uma, alguns testes ficam parciais — pule os marcados com 👥.
2. Marque `[ ]` → `[x]` conforme passa.
3. Falhou? Anote o número da etapa + comportamento observado, e abre uma issue no repo.
4. Tempo total estimado: **40-50 min** se tudo funcionar.

---

## 0. Pré-deploy

- [ ] Schemas aplicados no Supabase (v4 → v10) sem erro
- [ ] `notify pgrst, 'reload schema';` rodado após o último schema
- [ ] Bucket `avatars` (público) + `task-attachments` (privado) existem
- [ ] Build local passa (`npm run build`)
- [ ] Site abre em produção sem erro no console (F12)

---

## 1. Autenticação

- [ ] **Login** com e-mail + senha funciona
- [ ] Ícone de **olho** no campo senha alterna entre mascarado e visível
- [ ] Link **"Esqueci minha senha"** envia e-mail
- [ ] Link do e-mail abre `/reset-password` e permite definir nova senha
- [ ] **Sign up** cria conta e entra (ou pede confirmação por e-mail)
- [ ] **Sair** (no menu do avatar) volta pra tela de login
- [ ] Tentar entrar com senha errada → mensagem clara

## 2. Perfil

- [ ] Click no avatar (sidebar canto inferior) abre menu
- [ ] Click em **"Editar perfil"** abre modal
- [ ] Alterar nome → salvar → aparece no sidebar
- [ ] **Upload de avatar** funciona; aparece nas listagens
- [ ] Remover avatar → volta às iniciais
- [ ] **Tema**: alternar Claro / Escuro / Sistema na hora; recarregar mantém
- [ ] **Preferências de notificação** salvam e persistem

## 3. Espaços

- [ ] Dropdown de espaço no topo da sidebar mostra todos os ativos
- [ ] **Criar novo espaço** funciona; vira o ativo
- [ ] No menu `⋯` do espaço:
  - [ ] **Renomear** funciona inline (Enter salva, Esc cancela)
  - [ ] **Configurações do espaço** abre modal
  - [ ] **Mostrar/Ocultar arquivados** alterna corretamente
  - [ ] **Excluir espaço** com confirmação (soft delete + undo 5s)
- [ ] Menu `+` do espaço: cria Lista OU Pasta
- [ ] Se você não tem permissão (testar como B viewer): modal de criação mostra erro inline

## 4. Membros + Convites 👥

- [ ] Configurações do espaço → aba **Membros** lista você e quem está
- [ ] Gerar convite: deixar e-mail vazio + role "Membro" → **Copiar link**
- [ ] Aba anônima → abrir o link → criar conta nova → aceitar
- [ ] B aparece em **Membros** com role correta
- [ ] A pode promover B para Admin
- [ ] A pode remover B
- [ ] A NÃO pode rebaixar a si mesmo se for o único Owner

## 5. Permissões por pasta 👥

- [ ] Sidebar → cadeado na pasta abre **Permissões**
- [ ] B como `viewer` numa pasta: não consegue criar/editar listas nela
- [ ] B como `member`: pode criar listas dentro
- [ ] B como `admin` na pasta: pode mudar permissões

## 6. Pastas e Listas

- [ ] **Criar pasta** no menu `+` do espaço; aparece no sidebar
- [ ] **Criar lista** dentro de pasta (botão `+` na pasta); aparece aninhada
- [ ] **Criar lista** na raiz (`+` no espaço → Lista)
- [ ] **Renomear** pasta/lista inline (⋯ → Renomear OU click no nome no topbar pra lista)
- [ ] **Duplicar pasta**: cria "Cópia de X" com todas as listas filhas duplicadas
- [ ] **Duplicar lista**: copia tarefas + subtarefas + responsáveis + tags (NÃO copia anexos/comentários/deps)
- [ ] **Arquivar** lista/pasta → some
- [ ] Toggle "Mostrar arquivados" → aparecem com opacidade reduzida
- [ ] **Desarquivar** restaura
- [ ] **Excluir** com undo
- [ ] **Drag-drop** pra reordenar pastas raiz; refresh persiste a ordem
- [ ] **Drag-drop** pra reordenar listas dentro de uma pasta; idem
- [ ] **Drag-drop** pra reordenar listas raiz; idem

## 7. Status por espaço

- [ ] Configurações do espaço → aba **Status** lista os status atuais
- [ ] **Adicionar status** novo aparece imediatamente
- [ ] **Drag-drop** pra reordenar
- [ ] Editar nome inline; click no círculo abre paleta de cores
- [ ] Excluir status pede confirmação
- [ ] Criar lista nova → herda os status atuais do espaço
- [ ] Lista antiga: mantém os status que ela tinha quando foi criada

## 8. Tarefas (Board)

- [ ] **Adicionar tarefa** numa coluna → aparece
- [ ] Click numa tarefa → abre modal de detalhes
- [ ] No modal, abas: **Detalhes**, **Anexos**, **Dependências**
- [ ] Em Detalhes: título, descrição, status, prioridade, data de início, prazo
- [ ] Seção **Responsáveis**: atribuir 2+ usuários; aparece avatares no card
- [ ] **Drag-drop** entre colunas de status
- [ ] Hover no card revela `✓` (concluir), `📋` (duplicar), `⋯` (menu)
- [ ] ✓ alterna entre status Concluído e o anterior; título riscado quando concluída
- [ ] 📋 cria "Cópia de X" na mesma coluna
- [ ] ⋯ → Copiar link → URL contém `?task=ID` (testar abrir em aba anônima)
- [ ] ⋯ → Excluir com undo

## 9. Subtarefas estendidas

- [ ] Adicionar subtarefa
- [ ] Click expande linha; tem campos: responsável, prazo, descrição
- [ ] Marcar como concluída → progress bar atualiza
- [ ] Quando tem responsável/prazo, mostra pílula compacta na linha colapsada
- [ ] Excluir subtarefa

## 10. Anexos

- [ ] Aba Anexos → drag-drop OU click pra upload
- [ ] Arquivo aparece com ícone por tipo, nome, tamanho, autor, data
- [ ] Click no nome baixa via signed URL (abre nova aba)
- [ ] Lixeira remove
- [ ] Coluna "Anexos" na Lista mostra contagem 📎N
- [ ] Tarefa sem anexos: mostra "—"

## 11. Dependências

- [ ] Aba Dependências → adicionar predecessora
- [ ] Adicionar sucessora
- [ ] Abrir a outra tarefa → relação aparece do outro lado
- [ ] Tentar criar ciclo (A→B→A) → erro do banco
- [ ] Remover dependência

## 12. Comentários

- [ ] Adicionar comentário no sidebar do modal de tarefa
- [ ] Comentário aparece com avatar, nome, hora
- [ ] Coluna "Últimos comentários" na Lista mostra preview do último
- [ ] Tarefa sem comentários: mostra "—"

## 13. Campos personalizados (Lista)

- [ ] View Lista → botão **"Colunas"** abre painel deslizante à direita
- [ ] Aba **"Criar novo"**: tipos com ícones, click cria campo
- [ ] Testar cada tipo: text, number, date, select, multi_select, user, checkbox, currency, url, email, phone
- [ ] Editor de opções (para select/multi_select) com cores customizadas
- [ ] Aba **"Adicionar existente"**: toggle ON/OFF muda visibilidade
- [ ] Excluir campo personalizado pelo painel com confirmação
- [ ] Buscar no campo de busca filtra

## 14. View Lista

- [ ] Mostra colunas: Tarefa, Status, Responsável, Prazo, Prioridade, Comentários, Anexos
- [ ] **Drag-drop nos cabeçalhos** reordena colunas; refresh mantém
- [ ] **Agrupar por Status**: cria seções por status
- [ ] **Agrupar por Responsável**: cria seções por pessoa + "Sem responsável"
- [ ] Tarefa com 2+ responsáveis aparece em ambos os grupos quando agrupado por Responsável
- [ ] Chevron à esquerda do grupo colapsa/expande
- [ ] Estado colapsado persiste por lista
- [ ] **Ordenar**: Padrão, Prioridade, Prazo
- [ ] Hover na linha revela ✓ 📋 ⋯ (mesmo do Board)

## 15. View Gantt

- [ ] Aba "Gantt" no topbar
- [ ] Tarefas com prazo viram barras com cor do status
- [ ] Tarefas sem prazo em seção "Sem data"
- [ ] Linhas SVG conectam tarefas com dependências
- [ ] Click na barra abre modal
- [ ] Hover na linha lateral revela ✓ 📋 ⋯
- [ ] Zoom Dia / Semana / Mês

## 16. Filtros

- [ ] Barra de filtros: Status, Prioridade, Responsável, Prazo
- [ ] Pílula fica destacada quando filtro ativo
- [ ] Aplicar múltiplos filtros simultaneamente
- [ ] "Atrasadas" no filtro Prazo
- [ ] URL atualiza com query string
- [ ] Abrir URL com filtro em aba anônima (após login) → filtros aplicados

## 17. Visualizações salvas

- [ ] Botão "Visualizações" no topbar
- [ ] Aplicar filtros → Salvar visualização com nome
- [ ] Trocar pra outra visualização aplica os filtros dela
- [ ] Limpar filtros
- [ ] Excluir visualização

## 18. Busca global

- [ ] **Ctrl+K** abre modal de busca
- [ ] Digitar 2+ caracteres busca em tarefas, listas, pastas, espaços
- [ ] ↑↓ navega; Enter abre; Esc fecha
- [ ] Click numa tarefa abre modal correto

## 19. Sidebar

- [ ] **Resize**: arrastar edge direito muda largura (entre 200-480px); persiste
- [ ] **Colapsar** (botão de menu no topbar global) → sidebar some
- [ ] **Peek-on-hover**: passar mouse esquerda → sidebar aparece como overlay
- [ ] Expandir volta ao normal

## 20. Notificações 👥

- [ ] A atribui tarefa a B → B vê sino com badge `1` (sem F5)
- [ ] Click no sino abre dropdown com a notificação
- [ ] Click na notificação → abre modal da tarefa + marca como lida + badge zera
- [ ] A comenta em tarefa onde B é responsável → B recebe
- [ ] A muda status → B recebe
- [ ] Auto-atribuição NÃO notifica
- [ ] B desmarca pref "assigned" → A atribui → B NÃO recebe
- [ ] "Marcar todas como lidas" zera badge

## 21. Realtime

- [ ] Abrir 2 abas com a mesma lista
- [ ] Criar tarefa em uma → aparece na outra sem F5
- [ ] Editar título / status / responsável → reflete na outra
- [ ] Excluir tarefa → some na outra

## 22. Deep-link

- [ ] Copiar link de tarefa com `?task=ID`
- [ ] Abrir em aba anônima (após login) → modal abre automaticamente
- [ ] Fechar modal → `?task=` some da URL

## 23. Memória de navegação

- [ ] Abrir lista A em Board → trocar pra Gantt
- [ ] Ir pra lista B → cai em Board (default)
- [ ] Voltar pra A → cai em Gantt (lembra)
- [ ] Recarregar app na raiz `/` → cai no último espaço + lista usada

## 24. Release notes

- [ ] Chip "v1.x.x" no rodapé do sidebar
- [ ] Quando há versão nova (não vista): chip em accent com bolinha pulsando
- [ ] Click abre modal com histórico
- [ ] Após abrir, chip volta ao discreto

## 25. Dashboard

- [ ] Aba "Painel" na view
- [ ] Métricas: total, concluídas (%), atrasadas, alta prioridade
- [ ] Distribuição por status (barras)
- [ ] Prioridades (barras)
- [ ] Progresso geral
- [ ] Próximo prazo

## 26. Regressão crítica

Lista das funcionalidades essenciais — não devem QUEBRAR entre releases:

- [ ] Login funciona
- [ ] Criar tarefa básica funciona
- [ ] Drag-drop no Board não trava
- [ ] Modal de tarefa abre sem erro
- [ ] Sidebar não desaparece sozinha
- [ ] Console sem erros vermelhos em uso normal
- [ ] Realtime continua funcionando

---

## Observações sobre falhas

Use este espaço para anotar bugs encontrados:

```
[etapa X.Y] descrição do problema
    contexto: ...
    repro: ...
    resultado: ...
```
