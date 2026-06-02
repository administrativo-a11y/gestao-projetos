import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRealtimeSync } from './useRealtimeSync'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!notifications_related_actor_id_fkey(id, name, avatar_url),
        task:tasks!notifications_related_task_id_fkey(id, list_id, lists(space_id))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (err) setError(err.message)
    setNotifications(data ?? [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { refetch() }, [refetch])

  const subs = useMemo(() => user?.id ? [
    { table: 'notifications', filter: `user_id=eq.${user.id}` },
  ] : [], [user?.id])
  useRealtimeSync(user?.id ? `notifications:${user.id}` : null, subs, refetch)

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read_at).length,
    [notifications]
  )

  async function markAsRead(id) {
    const now = new Date().toISOString()
    // optimistic
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .is('read_at', null)
    if (error) refetch()
    return { error }
  }

  async function markAllAsRead() {
    if (!user?.id || unreadCount === 0) return
    const now = new Date().toISOString()
    setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)
    if (error) refetch()
    return { error }
  }

  async function remove(id) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) refetch()
    return { error }
  }

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, remove, refetch }
}
