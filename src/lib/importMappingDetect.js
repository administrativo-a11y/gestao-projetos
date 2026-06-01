// Detecta automaticamente o destino de cada coluna CSV baseado no nome do header.
// PT-BR + inglês.

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
  { dest: 'title',         patterns: [/^(title|nome|tarefa|task|name|titulo)$/] },
  { dest: 'description',   patterns: [/^(description|descricao|notas|notes|observacao|observacoes|detalhes)$/] },
  { dest: 'due_date',      patterns: [/^(due|prazo|vencimento|deadline|data de vencimento|data limite|data fim|fim)$/] },
  { dest: 'start_date',    patterns: [/^(start|inicio|comeco|data inicio|data inicial|data de inicio)$/] },
  { dest: 'priority',      patterns: [/^(priority|prioridade)$/] },
  { dest: 'status',        patterns: [/^(status|situacao|estado|fase|etapa)$/] },
  { dest: 'assignee_email',patterns: [/^(assignee|responsavel|owner|atribuido|atribuida|email|e mail|e-mail)$/] },
  { dest: 'tag',           patterns: [/^(tag|tags|etiqueta|etiquetas|categoria|categorias|rotulo|rotulos)$/] },
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
  if (/quantidade|qtd|numero|qty|count/.test(normalized)) return 'number'
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

/**
 * Mapeia uma string de data (DD/MM/YYYY, YYYY-MM-DD, etc.) pra yyyy-mm-dd.
 */
export function normalizeDate(s) {
  if (!s) return null
  const trimmed = s.trim()
  // yyyy-mm-dd
  let m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // dd/mm/yyyy or dd-mm-yyyy
  m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    return `${m[3]}-${mo}-${d}`
  }
  return null
}
