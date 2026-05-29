import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeSync } from './useRealtimeSync'

export function useSpaceStatuses(spaceId) {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    if (!spaceId) return
    setLoading(true)
    const { data } = await supabase
      .from('space_statuses')
      .select('*')
      .eq('space_id', spaceId)
      .order('position')
    setStatuses(data ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => { refetch() }, [refetch])

  const subs = useMemo(() => spaceId ? [
    { table: 'space_statuses', filter: `space_id=eq.${spaceId}` },
  ] : [], [spaceId])
  useRealtimeSync(spaceId ? `space-statuses:${spaceId}` : null, subs, refetch)

  async function addStatus({ name, color = '#888780' } = {}) {
    setError('')
    const position = statuses.length
    const { error } = await supabase
      .from('space_statuses')
      .insert({ space_id: spaceId, name: name?.trim() || 'Novo status', color, position })
    if (error) setError(error.message)
    return { error }
  }

  async function updateStatus(id, patch) {
    setError('')
    const { error } = await supabase.from('space_statuses').update(patch).eq('id', id)
    if (error) setError(error.message)
    return { error }
  }

  async function removeStatus(id) {
    setError('')
    const { error } = await supabase.from('space_statuses').delete().eq('id', id)
    if (error) setError(error.message)
    return { error }
  }

  async function reorder(orderedIds) {
    setError('')
    // Atualiza position de cada um conforme a ordem nova
    const updates = orderedIds.map((id, idx) =>
      supabase.from('space_statuses').update({ position: idx }).eq('id', id)
    )
    const results = await Promise.all(updates)
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) setError(firstErr.message)
    return { error: firstErr ?? null }
  }

  return { statuses, loading, error, addStatus, updateStatus, removeStatus, reorder, refetch }
}
