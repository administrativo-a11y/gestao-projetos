// Detecta automaticamente o destino de cada coluna CSV baseado no nome do header.
// PT-BR + inglês. Lida com exportações de ClickUp, Asana, Trello, etc.

function normalize(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const RULES = [
  // Título
  { dest: 'title',          patterns: [/^(title|nome|tarefa|task|name|titulo|task name|nome da tarefa)$/] },
  // Descrição (Latest Comment do ClickUp vira descrição, já que não temos onde colocar e é mais útil que perder)
  { dest: 'description',    patterns: [/^(description|descricao|notas|notes|observacao|observacoes|detalhes|comentario|latest comment|ultimo comentario|comments|content)$/] },
  // Datas
  { dest: 'due_date',       patterns: [/^(due|prazo|vencimento|deadline|data de vencimento|data limite|data fim|fim|due date|end date)$/] },
  { dest: 'start_date',     patterns: [/^(start|inicio|comeco|data inicio|data inicial|data de inicio|start date)$/] },
  // Prioridade
  { dest: 'priority',       patterns: [/^(priority|prioridade)$/] },
  // Status
  { dest: 'status',         patterns: [/^(status|situacao|estado|fase|etapa)$/] },
  // Assignee — separa email (match por email) e name (match por nome do profile)
  { dest: 'assignee_email', patterns: [/^(email|e mail|e mail do responsavel|assignee email|email atribuido)$/] },
  { dest: 'assignee_name',  patterns: [/^(assignee|assignees|responsavel|responsaveis|owner|atribuido|atribuida|atribuidos|assigned to|membros|members)$/] },
  // Tag
  { dest: 'tag',            patterns: [/^(tag|tags|etiqueta|etiquetas|categoria|categorias|rotulo|rotulos|label|labels)$/] },
  // Ignorar — colunas comuns de export que não fazem sentido importar
  { dest: '__ignore__',     patterns: [
    /^(task id|id|external id|url|link|task url|created at|criado em|created|updated at|updated|modified at|last modified|atualizado em)$/,
    /^(anexo|anexos|attachment|attachments|arquivo|arquivos)$/,
    /^(time logged|time logged rolled up|tempo|tempo logado|tempo registrado|time spent|tempo total)$/,
    /^(time estimate|estimativa|estimated time|estimate)$/,
  ] },
]

/**
 * @param {string[]} headers
 * @returns {Record<string, { dest: string, customFieldType?: string }>}
 */
export function autoDetectMapping(headers) {
  const result = {}
  for (const h of headers) {
    const n = normalize(h)
    let dest = null
    for (const rule of RULES) {
      if (rule.patterns.some(p => p.test(n))) {
        dest = rule.dest
        break
      }
    }
    if (dest) {
      result[h] = { dest }
    } else {
      // Tenta inferir um tipo razoável pelo nome
      result[h] = { dest: 'custom_field', customFieldType: inferCustomFieldType(n) }
    }
  }
  return result
}

function inferCustomFieldType(normalized) {
  if (/valor|preco|custo|orcamento|receita/.test(normalized)) return 'currency'
  if (/quantidade|qtd|numero|qty|count|conclusao|progresso|progress|percentual|percent/.test(normalized)) return 'number'
  if (/data|dt /.test(normalized)) return 'date'
  if (/email|e mail/.test(normalized)) return 'email'
  if (/telefone|fone|celular|whatsapp|cel/.test(normalized)) return 'phone'
  if (/site|url|link/.test(normalized)) return 'url'
  return 'text'
}

/**
 * Mapeia uma string de prioridade pra high/medium/low.
 */
export function normalizePriority(s) {
  const n = normalize(s)
  if (/alta|high|urgent/.test(n)) return 'high'
  if (/baixa|low/.test(n)) return 'low'
  if (/media|medium|normal/.test(n)) return 'medium'
  return null
}

const MONTHS_EN = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
}
const MONTHS_PT = {
  janeiro: '01', jan: '01',
  fevereiro: '02', fev: '02',
  marco: '03', mar: '03',
  abril: '04', abr: '04',
  maio: '05', mai: '05',
  junho: '06', jun: '06',
  julho: '07', jul: '07',
  agosto: '08', ago: '08',
  setembro: '09', set: '09',
  outubro: '10', out: '10',
  novembro: '11', nov: '11',
  dezembro: '12', dez: '12',
}

/**
 * Mapeia uma string de data pra yyyy-mm-dd.
 * Aceita:
 *  - YYYY-MM-DD (ISO)
 *  - DD/MM/YYYY ou DD-MM-YYYY (PT-BR)
 *  - "Friday, May 29th 2026" (ClickUp en)
 *  - "May 29, 2026" ou "May 29 2026" (en compacto)
 *  - "29 de maio de 2026" (PT-BR estendido)
 */
export function normalizeDate(s) {
  if (!s) return null
  const trimmed = s.toString().trim()
  if (!trimmed) return null

  // ISO: yyyy-mm-dd
  let m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  // PT-BR: dd/mm/yyyy ou dd-mm-yyyy
  m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    return `${m[3]}-${mo}-${d}`
  }

  // Datas em inglês/português com mês textual
  // Limpa: "Friday, " ou "Sexta, " no começo; sufixos "st/nd/rd/th" no dia
  const cleaned = trimmed
    .replace(/^[A-Za-zçãéê]+,\s*/i, '')         // remove dia da semana
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')      // remove sufixos ordinais
    .replace(/\bde\b/gi, '')                    // remove "de" do PT
    .replace(/\s+/g, ' ')
    .trim()

  // "May 29 2026" ou "May 29, 2026" ou "29 May 2026"
  // Tentativa 1: mês primeiro
  m = cleaned.match(/^([A-Za-zçãéê]+)\s+(\d{1,2}),?\s+(\d{4})$/i)
  if (m) {
    const monthKey = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const month = MONTHS_EN[monthKey] ?? MONTHS_PT[monthKey]
    if (month) return `${m[3]}-${month}-${m[2].padStart(2, '0')}`
  }
  // Tentativa 2: dia primeiro
  m = cleaned.match(/^(\d{1,2})\s+([A-Za-zçãéê]+),?\s+(\d{4})$/i)
  if (m) {
    const monthKey = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const month = MONTHS_EN[monthKey] ?? MONTHS_PT[monthKey]
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
  }

  // Última tentativa: deixar o JS interpretar (menos confiável, mas pega casos exóticos)
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return null
}

/**
 * Extrai nomes de uma string de assignees no formato do ClickUp.
 * Aceita: "[Nome 1],[Nome 2]" → ["Nome 1", "Nome 2"]
 * Aceita: "Nome 1, Nome 2" → ["Nome 1", "Nome 2"]
 * Aceita: "Nome único" → ["Nome único"]
 */
export function parseAssigneeNames(raw) {
  if (!raw) return []
  const s = String(raw).trim()
  if (!s) return []
  // Se tem brackets, extrai cada bracket separadamente
  const bracketMatches = s.match(/\[([^\]]+)\]/g)
  if (bracketMatches && bracketMatches.length > 0) {
    return bracketMatches.map(b => b.slice(1, -1).trim()).filter(Boolean)
  }
  // Senão split por vírgula ou ponto-e-vírgula
  return s.split(/[,;]/).map(x => x.trim()).filter(Boolean)
}
