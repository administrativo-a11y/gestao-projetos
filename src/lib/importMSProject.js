// Parser de MS Project XML (formato Microsoft Project XML).
// Sem dependências — DOMParser nativo.

/**
 * @param {string} xmlText
 * @returns {{
 *   listName: string,
 *   tasks: Array<{
 *     externalUID: string,
 *     title: string,
 *     description: string,
 *     start_date: string|null,
 *     due_date: string|null,
 *     priority: 'high'|'medium'|'low',
 *     done: boolean,
 *     assignee_emails: string[],
 *     subtasks: Array<{ title: string, description: string, done: boolean, due_date: string|null, assignee_emails: string[] }>
 *   }>,
 *   dependencies: Array<{ predUID: string, succUID: string, type: 'FS'|'SS'|'FF'|'SF' }>,
 *   warnings: string[],
 * }}
 */
export function parseMSProject(xmlText) {
  const warnings = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Arquivo XML inválido ou corrompido.')
  }

  const projectName = textOf(doc.querySelector('Project > Name')) || 'Importação MS Project'

  // Resources: { UID -> { name, email } }
  const resources = {}
  doc.querySelectorAll('Project > Resources > Resource').forEach(r => {
    const uid = textOf(r.querySelector('UID'))
    if (!uid || uid === '0') return // UID 0 = "Unassigned"
    const name = textOf(r.querySelector('Name'))
    const email = textOf(r.querySelector('EmailAddress'))
    resources[uid] = { name, email }
  })

  // Assignments: TaskUID -> [emails]
  const taskAssignees = {}
  doc.querySelectorAll('Project > Assignments > Assignment').forEach(a => {
    const taskUID = textOf(a.querySelector('TaskUID'))
    const resourceUID = textOf(a.querySelector('ResourceUID'))
    if (!taskUID || !resourceUID || resourceUID === '0') return
    const res = resources[resourceUID]
    if (!res || !res.email) return
    if (!taskAssignees[taskUID]) taskAssignees[taskUID] = []
    if (!taskAssignees[taskUID].includes(res.email)) {
      taskAssignees[taskUID].push(res.email)
    }
  })

  // Tasks
  const rawTasks = []
  doc.querySelectorAll('Project > Tasks > Task').forEach(t => {
    if (textOf(t.querySelector('IsNull')) === '1') return
    const uid = textOf(t.querySelector('UID'))
    if (!uid || uid === '0') return
    const outline = parseInt(textOf(t.querySelector('OutlineLevel')) || '1', 10)
    const isSummary = textOf(t.querySelector('Summary')) === '1'
    const name = textOf(t.querySelector('Name')) || `Tarefa ${uid}`
    const notes = textOf(t.querySelector('Notes'))
    const start = parseDate(textOf(t.querySelector('Start')))
    const finish = parseDate(textOf(t.querySelector('Finish')))
    const percent = parseInt(textOf(t.querySelector('PercentComplete')) || '0', 10)
    const priorityNum = parseInt(textOf(t.querySelector('Priority')) || '500', 10)
    const priority = priorityNum < 300 ? 'low' : priorityNum > 700 ? 'high' : 'medium'

    // PredecessorLinks
    const predLinks = []
    t.querySelectorAll('PredecessorLink').forEach(p => {
      const predUID = textOf(p.querySelector('PredecessorUID'))
      const type = textOf(p.querySelector('Type'))
      if (predUID) predLinks.push({ predUID, type })
    })

    rawTasks.push({
      uid, outline, isSummary, name, notes,
      start, finish, percent, priority,
      assignee_emails: taskAssignees[uid] ?? [],
      predLinks,
    })
  })

  // Hierarquiza: nível 1 + Summary=1 vira task com subtasks (nível 2)
  // Nível 1 sem Summary → task sem subtasks
  // Nível 3+ → achata pra subtask do Summary mais próximo
  const tasks = []
  let currentSummary = null
  for (const t of rawTasks) {
    if (t.outline <= 1) {
      const task = baseTaskFrom(t)
      if (t.isSummary) {
        task.subtasks = []
        currentSummary = task
      } else {
        currentSummary = null
      }
      tasks.push(task)
    } else {
      // outline >= 2
      const subtask = baseSubtaskFrom(t)
      if (currentSummary) {
        if (t.outline > 2) {
          subtask.description = (subtask.description ? subtask.description + '\n\n' : '') +
            `[Originalmente nível ${t.outline} no MS Project]`
          warnings.push(`Tarefa "${t.name}" estava no nível ${t.outline} — foi achatada pra subtarefa.`)
        }
        currentSummary.subtasks.push(subtask)
      } else {
        // Nível 2 sem ancestral Summary — vira tarefa solta
        tasks.push(baseTaskFrom(t))
      }
    }
  }

  // Dependências (só FS)
  const dependencies = []
  for (const t of rawTasks) {
    for (const link of t.predLinks) {
      const typeMap = { '0': 'FF', '1': 'FS', '2': 'SS', '3': 'SF' }
      const type = typeMap[link.type] ?? 'FS'
      if (type !== 'FS') {
        warnings.push(`Dependência ${link.predUID} → ${t.uid} é do tipo ${type} — só FS é importado. Ignorada.`)
        continue
      }
      dependencies.push({ predUID: link.predUID, succUID: t.uid, type: 'FS' })
    }
  }

  return {
    listName: projectName,
    tasks,
    dependencies,
    warnings,
  }
}

// — Helpers ——————————————————————————————————————————————————————

function textOf(node) {
  return node?.textContent?.trim() ?? ''
}

function parseDate(s) {
  if (!s) return null
  // MS Project usa "2024-01-15T08:00:00"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function baseTaskFrom(t) {
  return {
    externalUID: t.uid,
    title: t.name,
    description: t.notes ?? '',
    start_date: t.start,
    due_date: t.finish,
    priority: t.priority,
    done: t.percent >= 100,
    assignee_emails: t.assignee_emails,
    subtasks: [],
  }
}

function baseSubtaskFrom(t) {
  return {
    title: t.name,
    description: t.notes ?? '',
    due_date: t.finish,
    done: t.percent >= 100,
    assignee_emails: t.assignee_emails,
  }
}
