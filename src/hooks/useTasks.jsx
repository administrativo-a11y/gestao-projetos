import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

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
        task_assignees(user_id, profiles(id, name)),
        task_tags(tag_id, tags(id, name, color)),
        subtasks(id, done)
      `).eq('list_id', listId).is('deleted_at', null).order('position'),
    ])
    setStatuses(statusRes.data ?? [])
    setTasks(taskRes.data ?? [])
    setLoading(false)
  }, [listId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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

  return {
    statuses, tasks, members, loading,
    createTask, updateTask, moveTask, softDeleteTask, undoDeleteTask,
    refetch: fetchAll
  }
}
