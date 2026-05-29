import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRealtimeSync } from './useRealtimeSync'

export function useTasks(listId) {
  const { user } = useAuth()
  const [statuses, setStatuses] = useState([])
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    const [statusRes, taskRes] = await Promise.all([
      supabase.from('list_statuses').select('*').eq('list_id', listId).order('position'),
      supabase.from('tasks').select(`
        *,
        task_assignees(user_id, profiles(id, name, avatar_url)),
        task_tags(tag_id, tags(id, name, color)),
        subtasks(id, done, title, assignee_id, due_date, description, position)
      `).eq('list_id', listId).is('deleted_at', null).order('position'),
    ])
    setStatuses(statusRes.data ?? [])
    setTasks(taskRes.data ?? [])
    setLoading(false)
  }, [listId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime: refetch quando qualquer coisa muda nas tabelas da tarefa.
  // RLS no banco garante que só recebemos eventos do que podemos ver.
  const subscriptions = useMemo(() => listId ? [
    { table: 'tasks', filter: `list_id=eq.${listId}` },
    { table: 'list_statuses', filter: `list_id=eq.${listId}` },
    // subtasks/assignees/tags não têm list_id; subscrevemos sem filtro,
    // RLS limita o que chega.
    { table: 'subtasks' },
    { table: 'task_assignees' },
    { table: 'task_tags' },
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
    setAssignees,
    refetch: fetchAll
  }
}
