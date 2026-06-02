import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { normalizePriority, normalizeDate } from '../lib/importMappingDetect'

/**
 * Hook que executa a importação em lote.
 *
 * Uso:
 *   const { progress, importing, doImport, lastResult } = useImport()
 *   await doImport({ spaceId, targetListId, listName, folderId, source, mapping })
 *
 * `source` é o resultado de parseCSV ou parseMSProject.
 * `mapping` (CSV apenas) é { [header]: { dest, customFieldType? } }.
 */
export function useImport() {
  const { user } = useAuth()
  const [progress, setProgress] = useState({ phase: '', current: 0, total: 0, errors: [] })
  const [importing, setImporting] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const reset = useCallback(() => {
    setProgress({ phase: '', current: 0, total: 0, errors: [] })
    setLastResult(null)
  }, [])

  async function doImport(args) {
    setImporting(true)
    setLastResult(null)
    const errors = []
    try {
      const result = await runImport(args, user, errors, setProgress)
      setLastResult({ ...result, errors })
      return { ...result, errors }
    } catch (err) {
      errors.push(err.message ?? String(err))
      const r = { ok: false, errors }
      setLastResult(r)
      return r
    } finally {
      setImporting(false)
    }
  }

  return { progress, importing, doImport, lastResult, reset }
}

async function runImport(
  { spaceId, targetListId, listName, folderId, source, mapping, kind },
  user,
  errors,
  setProgress
) {
  // 1) Resolve a lista alvo
  setProgress({ phase: 'Preparando lista...', current: 0, total: 0, errors: [] })
  let listId = targetListId
  if (!listId) {
    const { data: created, error } = await supabase
      .from('lists')
      .insert({
        space_id: spaceId,
        folder_id: folderId ?? null,
        name: listName?.trim() || 'Lista importada',
      })
      .select('*, space_statuses(*)')
      .single()
    if (error) throw new Error('Não foi possível criar a lista: ' + error.message)
    listId = created.id

    // Copia os status do espaço (igual ao fluxo normal de criação, incluindo category)
    const { data: spaceStatuses } = await supabase
      .from('space_statuses')
      .select('name, color, position, category')
      .eq('space_id', spaceId)
      .order('position')
    if (spaceStatuses?.length > 0) {
      await supabase.from('list_statuses').insert(
        spaceStatuses.map(s => ({
          list_id: listId,
          name: s.name,
          color: s.color,
          position: s.position,
          category: s.category ?? 'open',
        }))
      )
    }
  }

  // 2) Carrega status da lista (precisa pra resolver status_id)
  const { data: listStatuses } = await supabase
    .from('list_statuses').select('*').eq('list_id', listId).order('position')
  const defaultStatusId = listStatuses?.[0]?.id ?? null
  const doneStatus = listStatuses?.find(s => /^conclu/i.test(s.name))
  const doneStatusId = doneStatus?.id ?? defaultStatusId

  // 3) Carrega membros do espaço (pra resolver responsáveis por email)
  const { data: members } = await supabase
    .from('space_members')
    .select('user_id, profiles(email)')
    .eq('space_id', spaceId)
  const emailToUserId = new Map()
  for (const m of (members ?? [])) {
    const email = m.profiles?.email?.toLowerCase()
    if (email) emailToUserId.set(email, m.user_id)
  }

  // 4) Cria custom fields (CSV) se necessário
  const customFieldByHeader = new Map() // header -> field row
  if (kind === 'csv' && mapping) {
    const newFields = []
    for (const [header, m] of Object.entries(mapping)) {
      if (m.dest === 'custom_field') {
        newFields.push({
          list_id: listId,
          name: header,
          type: m.customFieldType ?? 'text',
          options: {},
          position: 0,
        })
      }
    }
    if (newFields.length > 0) {
      setProgress({ phase: 'Criando campos personalizados...', current: 0, total: newFields.length, errors: [] })
      // posição: começa do max atual
      const { data: existing } = await supabase
        .from('custom_fields').select('position').eq('list_id', listId).order('position', { ascending: false }).limit(1)
      let pos = (existing?.[0]?.position ?? -1) + 1
      for (const f of newFields) f.position = pos++
      const { data: created, error } = await supabase
        .from('custom_fields').insert(newFields).select()
      if (error) {
        errors.push('Falha ao criar campos personalizados: ' + error.message)
      } else {
        for (let i = 0; i < newFields.length; i++) {
          customFieldByHeader.set(newFields[i].name, created[i])
        }
      }
    }
  }

  // 5) Monta payload de tasks
  setProgress({ phase: 'Preparando tarefas...', current: 0, total: 0, errors: [] })
  const tasksPayload = []          // [{ payload, externalUID, assignee_emails, subtasks, field_values }]

  if (kind === 'xml') {
    // source.tasks já está hierarquizado
    let pos = 0
    for (const t of source.tasks) {
      tasksPayload.push({
        payload: {
          list_id: listId,
          status_id: t.done ? doneStatusId : defaultStatusId,
          title: t.title,
          description: t.description || null,
          start_date: t.start_date,
          due_date: t.due_date,
          priority: t.priority,
          position: pos++,
          created_by: user?.id,
        },
        externalUID: t.externalUID,
        assignee_emails: t.assignee_emails ?? [],
        subtasks: t.subtasks ?? [],
        field_values: [],
      })
    }
  } else if (kind === 'csv') {
    let pos = 0
    for (const row of source.rows) {
      let title = null, description = null, due_date = null, start_date = null
      let priority = 'medium', statusName = null, assignee_email = null, tagsStr = null
      const fieldValues = []
      for (const [header, value] of Object.entries(row)) {
        if (!value || value.trim() === '') continue
        const m = mapping[header]
        if (!m) continue
        switch (m.dest) {
          case 'title': title = value; break
          case 'description': description = value; break
          case 'due_date': due_date = normalizeDate(value); break
          case 'start_date': start_date = normalizeDate(value); break
          case 'priority': priority = normalizePriority(value) ?? 'medium'; break
          case 'status': statusName = value.trim(); break
          case 'assignee_email': assignee_email = value.trim().toLowerCase(); break
          case 'tag': tagsStr = value; break
          case 'custom_field': {
            const field = customFieldByHeader.get(header)
            if (field) {
              const cast = castFieldValue(field.type, value)
              if (cast !== null) fieldValues.push({ field_id: field.id, value: cast })
            }
            break
          }
          default: break
        }
      }
      if (!title || !title.trim()) continue // pula linhas sem título

      // Resolve status_id por nome (se mapeado)
      let status_id = defaultStatusId
      if (statusName) {
        const match = listStatuses?.find(s => s.name.toLowerCase() === statusName.toLowerCase())
        if (match) status_id = match.id
      }

      tasksPayload.push({
        payload: {
          list_id: listId,
          status_id,
          title: title.trim(),
          description: description ?? null,
          start_date,
          due_date,
          priority,
          position: pos++,
          created_by: user?.id,
        },
        externalUID: null,
        assignee_emails: assignee_email ? [assignee_email] : [],
        subtasks: [],
        field_values: fieldValues,
      })
    }
  }

  if (tasksPayload.length === 0) {
    return { ok: true, listId, created: 0, message: 'Nenhuma tarefa encontrada no arquivo.' }
  }

  // 6) Insere tasks em lote
  setProgress({ phase: 'Criando tarefas...', current: 0, total: tasksPayload.length, errors: [] })
  const { data: createdTasks, error: tasksError } = await supabase
    .from('tasks')
    .insert(tasksPayload.map(t => t.payload))
    .select('id, title')
  if (tasksError) throw new Error('Falha ao criar tarefas: ' + tasksError.message)

  const uidToNewId = new Map() // externalUID -> newTaskId (pra dependências)
  const newTaskById = []
  for (let i = 0; i < tasksPayload.length; i++) {
    const created = createdTasks[i]
    newTaskById.push({ row: tasksPayload[i], newId: created.id })
    if (tasksPayload[i].externalUID) {
      uidToNewId.set(tasksPayload[i].externalUID, created.id)
    }
  }

  // 7) Subtasks
  const allSubtasks = []
  for (const { row, newId } of newTaskById) {
    let sPos = 0
    for (const s of row.subtasks) {
      allSubtasks.push({
        _parentRow: row,
        _parentNewId: newId,
        _emails: s.assignee_emails ?? [],
        payload: {
          task_id: newId,
          title: s.title,
          done: !!s.done,
          position: sPos++,
          due_date: s.due_date ?? null,
          description: s.description || null,
        },
      })
    }
  }
  if (allSubtasks.length > 0) {
    setProgress({ phase: 'Criando subtarefas...', current: 0, total: allSubtasks.length, errors: [] })
    const { error: subErr } = await supabase
      .from('subtasks').insert(allSubtasks.map(s => s.payload))
    if (subErr) errors.push('Falha ao criar subtarefas: ' + subErr.message)
  }

  // 8) Assignees
  const assigneeRows = []
  const unmatchedEmails = new Set()
  for (const { row, newId } of newTaskById) {
    for (const email of row.assignee_emails) {
      const uid = emailToUserId.get(email.toLowerCase())
      if (uid) {
        assigneeRows.push({ task_id: newId, user_id: uid })
      } else {
        unmatchedEmails.add(email)
      }
    }
  }
  if (assigneeRows.length > 0) {
    setProgress({ phase: 'Vinculando responsáveis...', current: 0, total: assigneeRows.length, errors: [] })
    const { error: assErr } = await supabase
      .from('task_assignees').insert(assigneeRows)
    if (assErr) errors.push('Falha ao vincular responsáveis: ' + assErr.message)
  }
  if (unmatchedEmails.size > 0) {
    errors.push(`E-mails sem match nos membros do espaço (ignorados): ${[...unmatchedEmails].join(', ')}`)
  }

  // 9) Custom field values (CSV)
  const fieldValuesRows = []
  for (const { row, newId } of newTaskById) {
    for (const fv of row.field_values) {
      fieldValuesRows.push({ task_id: newId, field_id: fv.field_id, value: fv.value })
    }
  }
  if (fieldValuesRows.length > 0) {
    setProgress({ phase: 'Preenchendo campos personalizados...', current: 0, total: fieldValuesRows.length, errors: [] })
    const { error: fvErr } = await supabase
      .from('task_field_values').insert(fieldValuesRows)
    if (fvErr) errors.push('Falha ao salvar campos personalizados: ' + fvErr.message)
  }

  // 10) Dependências (XML)
  if (kind === 'xml' && source.dependencies?.length > 0) {
    const depRows = []
    for (const d of source.dependencies) {
      const predId = uidToNewId.get(d.predUID)
      const succId = uidToNewId.get(d.succUID)
      if (predId && succId) {
        depRows.push({ predecessor_id: predId, successor_id: succId, type: d.type })
      }
    }
    if (depRows.length > 0) {
      setProgress({ phase: 'Criando dependências...', current: 0, total: depRows.length, errors: [] })
      const { error: depErr } = await supabase
        .from('task_dependencies').insert(depRows)
      if (depErr) errors.push('Falha ao criar dependências: ' + depErr.message)
    }
  }

  setProgress({ phase: 'Concluído', current: tasksPayload.length, total: tasksPayload.length, errors })

  return {
    ok: true,
    listId,
    created: tasksPayload.length,
    subtasks: allSubtasks.length,
    assignees: assigneeRows.length,
    customFields: customFieldByHeader.size,
    dependencies: kind === 'xml' ? (source.dependencies?.length ?? 0) : 0,
  }
}

function castFieldValue(type, raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null
  switch (type) {
    case 'number':
    case 'currency': {
      const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    case 'date': return normalizeDate(s)
    case 'checkbox': return /^(true|1|sim|yes|y|x)$/i.test(s)
    case 'multi_select': return s.split(/[,;]/).map(x => x.trim()).filter(Boolean)
    default: return s
  }
}
