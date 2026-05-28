import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useSavedViews(listId) {
  const { user } = useAuth()
  const [views, setViews] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!listId || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('saved_views')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setViews(data ?? [])
    setLoading(false)
  }, [listId, user])

  useEffect(() => { refetch() }, [refetch])

  async function save({ name, config }) {
    if (!user || !listId) return { error: new Error('Faltam dados') }
    // upsert pelo composto (user_id, list_id, name)
    const { data, error } = await supabase
      .from('saved_views')
      .upsert(
        { user_id: user.id, list_id: listId, name, config },
        { onConflict: 'user_id,list_id,name' }
      )
      .select()
      .single()
    if (!error) await refetch()
    return { data, error }
  }

  async function remove(id) {
    const { error } = await supabase.from('saved_views').delete().eq('id', id)
    if (!error) await refetch()
    return { error }
  }

  return { views, loading, save, remove, refetch }
}
