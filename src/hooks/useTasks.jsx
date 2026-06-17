import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRealtimeSync } from './useRealtimeSync'

export function useTasks(listId) {
  const { user } = useAuth()
  const [statuses, setStatuses] = useState([])
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Rastreia qual listId está "ativo". Respostas de fetches de listas anteriores
  // são descartadas (race condition quando o user troca de lista rapidamente).
  const activeListIdRef = useRef(listId)
  useEffect(() => { activeListIdRef.current = listId }, [listId])

  const fetchAll = useCallback(async () => {
    if (!listId) {
      // Limpa estado quando não há lista
      setStatuses([])
      setTasks([])
      setLoading(false)
      return
    }
    const requestedListId = listId
    setLoading(true)
    try {
      const [statusRes, taskRes] = await Promise.all([
        supabase.from('list_statuses').select('*').eq('list_id', requestedListId).order('position'),
        supabase.from('tasks').select(`
          *,
          task_assignees(user_id, profiles(id, name, avatar_url)),
          task_tags(tag_id, tags(id, name, color)),
          subtasks(id, done, title, assignee_id, due_date, description, position),
          task_field_values(field_id, value),
          comments(id, content, created_at, user_id, profiles(name, avatar_url)),
          task_attachments(id, file_name)
        `).eq('list_id', requestedListId).is('deleted_at', null).order('position'),
      ])
      // Só aplica e libera loading se ainda for o fetch atual.
      // Se mudou de lista no meio, o useEffect já disparou novo fetchAll que vai
      // setar loading=false quando terminar.
      if (activeListIdRef.current !== requestedListId) return
      setStatuses(statusRes.data ?? [])
      setTasks(taskRes.data ?? [])
      setLoading(false)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[useTasks] fetchAll falhou:', err)
      if (activeListIdRef.current === requestedListId) {
        setLoading(false)
      }
    }
  }, [listId])

  useEffect(() => {
    // Reseta o estado imediatamente ao trocar de lista, pra não exibir
    // dados da lista anterior enquanto o novo fetch roda.
    setStatuses([])
    setTasks([])
    setLoading(true)
    fetchAll()
  }, [fetchAll])

  // Refetch quando a aba volta a ter foco — pega mudanças que aconteceram
  // enquanto o usuário estava em outra aba ou no SQL Editor.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && listId) {
        fetchAll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [fetchAll, listId])

  // Realtime: refetch quando qualquer coisa muda nas tabelas da tarefa.
  // RLS no banco garante que só recebemos eventos do que podemos ver.
  const subscriptions = useMemo(() => listId ? [
    { table: 'tasks', filter: `list_id=eq.${listId}` },
    { table: 'list_statuses', filter: `list_id=eq.${listId}` },
    // subtasks/assignees/tags/field_values não têm list_id; subscrevemos sem filtro,
    // RLS limita o que chega.
    { table: 'subtasks' },
    { table: 'task_assignees' },
    { table: 'task_tags' },
    { table: 'task_field_values' },
  ] : [], [listId])
  useRealtimeSync(listId ? `tasks:${listId}` : null, subscriptions, fetchAll)

  async function createTask({ statusId, title, priority, dueDate }) {
    const maxPos = tasks.filter(t => t.status_id === statusId).length
    const { error } = await supabase.from('tasks').insert({
      list_id: listId,
      status_id: statusId,
      title,
      priority: priority ?? 'medium',
      due_date: dueDate ?? null,
      position: maxPos,
      created_by: user?.id
    })
    if (!error) await fetchAll()
    return { error }
  }

  async function updateTask(taskId, updates) {
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (!error) await fetchAll()
    return { error }
  }

  async function moveTask(taskId, newStatusId, newPosition) {
    const { error } = await supabase
      .from('tasks')
      .update({ status_id: newStatusId, position: newPosition })
      .eq('id', taskId)
    if (!error) await fetchAll()
    return { error }
  }

  async function softDeleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId)
    if (!error) await fetchAll()
    return { error }
  }

  async function undoDeleteTask(taskId) {
    await supabase.from('tasks').update({ deleted_at: null }).eq('id', taskId)
    await fetchAll()
  }

  // Alterna o status entre "Concluído" e o anterior. Procura por status cujo nome
  // começa com "conclu" (Concluído/Concluida). Se não houver, usa o último status.
  async function toggleDone(taskId) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return { error: new Error('Tarefa não encontrada') }
    const doneStatus =
      statuses.find(s => /^conclu/i.test(s.name)) ??
      statuses[statuses.length - 1]
    if (!doneStatus) return { error: new Error('Sem status disponível') }

    const isDone = task.status_id === doneStatus.id
    let newStatusId
    if (isDone) {
      // Volta pro primeiro status que NÃO é done
      const other = statuses.find(s => s.id !== doneStatus.id) ?? statuses[0]
      newStatusId = other.id
    } else {
      newStatusId = doneStatus.id
    }
    return updateTask(taskId, { status_id: newStatusId })
  }

  // Duplica a tarefa na mesma lista, copiando título/desc/prazos/prioridade
  // mais responsáveis, tags e subtarefas. Não copia anexos, comentários
  // nem dependências.
  async function duplicateTask(taskId) {
    const t = tasks.find(x => x.id === taskId)
    if (!t) return { error: new Error('Tarefa não encontrada') }

    const samePos = tasks.filter(x => x.status_id === t.status_id).length
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        list_id: t.list_id,
        status_id: t.status_id,
        title: `Cópia de ${t.title}`,
        description: t.description,
        priority: t.priority,
        due_date: t.due_date,
        start_date: t.start_date,
        position: samePos,
        created_by: user?.id,
      })
      .select()
      .single()
    if (error || !newTask) return { error }

    // Subtarefas
    const subs = (t.subtasks ?? []).map(s => ({
      task_id: newTask.id,
      title: s.title,
      done: false,
      position: s.position,
      assignee_id: s.assignee_id ?? null,
      due_date: s.due_date ?? null,
      description: s.description ?? null,
    }))
    if (subs.length > 0) await supabase.from('subtasks').insert(subs)

    // Responsáveis
    const assignees = (t.task_assignees ?? []).map(a => ({
      task_id: newTask.id,
      user_id: a.user_id,
    }))
    if (assignees.length > 0) {
      await supabase.from('task_assignees').insert(assignees)
    }

    // Tags
    const tags = (t.task_tags ?? []).map(tt => ({
      task_id: newTask.id,
      tag_id: tt.tag_id,
    }))
    if (tags.length > 0) await supabase.from('task_tags').insert(tags)

    await fetchAll()
    return { data: newTask, error: null }
  }

  // Upsert do valor de um campo personalizado pra uma tarefa.
  // Valor `null`/undefined → remove o registro.
  async function setFieldValue(taskId, fieldId, value) {
    if (value === null || value === undefined ||
        (typeof value === 'string' && value === '') ||
        (Array.isArray(value) && value.length === 0)) {
      return clearFieldValue(taskId, fieldId)
    }
    const { error } = await supabase
      .from('task_field_values')
      .upsert(
        { task_id: taskId, field_id: fieldId, value },
        { onConflict: 'task_id,field_id' }
      )
    if (!error) await fetchAll()
    return { error }
  }

  async function clearFieldValue(taskId, fieldId) {
    const { error } = await supabase
      .from('task_field_values')
      .delete()
      .eq('task_id', taskId)
      .eq('field_id', fieldId)
    if (!error) await fetchAll()
    return { error }
  }

  // Cria uma subtarefa solta (sem assignee/prazo). Usado pelo inline create da Lista.
  async function addSubtask(taskId, title) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return { error: new Error('Tarefa não encontrada') }
    const trimmed = title?.trim()
    if (!trimmed) return { error: new Error('Título obrigatório') }
    const maxPos = (task.subtasks ?? []).length
    const { error } = await supabase.from('subtasks').insert({
      task_id: taskId,
      title: trimmed,
      done: false,
      position: maxPos,
    })
    if (!error) await fetchAll()
    return { error }
  }

  async function setAssignees(taskId, newUserIds) {
    const task = tasks.find(t => t.id === taskId)
    const current = (task?.task_assignees ?? []).map(a => a.user_id)
    const toAdd = newUserIds.filter(id => !current.includes(id))
    const toRemove = current.filter(id => !newUserIds.includes(id))

    if (toAdd.length > 0) {
      await supabase
        .from('task_assignees')
        .insert(toAdd.map(uid => ({ task_id: taskId, user_id: uid })))
    }
    if (toRemove.length > 0) {
      await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .in('user_id', toRemove)
    }
    await fetchAll()
  }

  return {
    statuses, tasks, members, loading,
    createTask, updateTask, moveTask, softDeleteTask, undoDeleteTask,
    setAssignees, toggleDone, duplicateTask, addSubtask,
    setFieldValue, clearFieldValue,
    refetch: fetchAll
  }
}
