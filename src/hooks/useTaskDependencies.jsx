import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Hook por tarefa: fetch predecessores + sucessores
export function useTaskDependencies(taskId) {
  const [predecessors, setPredecessors] = useState([])
  const [successors, setSuccessors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    const [predRes, succRes] = await Promise.all([
      supabase
        .from('task_dependencies')
        .select('id, type, predecessor:tasks!task_dependencies_predecessor_id_fkey(id, title, status_id, due_date, start_date)')
        .eq('successor_id', taskId),
      supabase
        .from('task_dependencies')
        .select('id, type, successor:tasks!task_dependencies_successor_id_fkey(id, title, status_id, due_date, start_date)')
        .eq('predecessor_id', taskId),
    ])
    setPredecessors(predRes.data ?? [])
    setSuccessors(succRes.data ?? [])
    setLoading(false)
  }, [taskId])

  useEffect(() => { refetch() }, [refetch])

  async function addPredecessor(predecessorId) {
    setError('')
    const { error } = await supabase
      .from('task_dependencies')
      .insert({ predecessor_id: predecessorId, successor_id: taskId, type: 'FS' })
    if (error) { setError(error.message); return { error } }
    await refetch()
    return { error: null }
  }

  async function addSuccessor(successorId) {
    setError('')
    const { error } = await supabase
      .from('task_dependencies')
      .insert({ predecessor_id: taskId, successor_id: successorId, type: 'FS' })
    if (error) { setError(error.message); return { error } }
    await refetch()
    return { error: null }
  }

  async function removeDependency(depId) {
    setError('')
    const { error } = await supabase.from('task_dependencies').delete().eq('id', depId)
    if (error) { setError(error.message); return { error } }
    await refetch()
    return { error: null }
  }

  return {
    predecessors, successors, loading, error,
    addPredecessor, addSuccessor, removeDependency, refetch,
  }
}

// Hook por lista: fetch todas dependências da lista — usado pelo Gantt
export function useListDependencies(listId) {
  const [deps, setDeps] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    // Lê todas dependências em que predecessor OU sucessor pertencem à lista
    const { data } = await supabase
      .from('task_dependencies')
      .select(`
        id, type,
        predecessor:tasks!task_dependencies_predecessor_id_fkey(id, list_id),
        successor:tasks!task_dependencies_successor_id_fkey(id, list_id)
      `)
    // Filtra client-side para tarefas da lista (uma vez RLS já restringe ao que vemos)
    const filtered = (data ?? []).filter(d =>
      d.predecessor?.list_id === listId && d.successor?.list_id === listId
    )
    setDeps(filtered)
    setLoading(false)
  }, [listId])

  useEffect(() => { refetch() }, [refetch])

  return { deps, loading, refetch }
}
