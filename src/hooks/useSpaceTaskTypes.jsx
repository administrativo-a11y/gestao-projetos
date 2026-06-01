import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeSync } from './useRealtimeSync'

export function useSpaceTaskTypes(spaceId) {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!spaceId) { setTypes([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('space_task_types')
      .select('*')
      .eq('space_id', spaceId)
      .order('position')
    setTypes(data ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const subs = useMemo(() => spaceId ? [
    { table: 'space_task_types', filter: `space_id=eq.${spaceId}` },
  ] : [], [spaceId])
  useRealtimeSync(spaceId ? `space_task_types:${spaceId}` : null, subs, fetchAll)

  const defaultType = useMemo(
    () => types.find(t => t.is_default) ?? types[0] ?? null,
    [types]
  )

  return { types, loading, defaultType, refetch: fetchAll }
}
