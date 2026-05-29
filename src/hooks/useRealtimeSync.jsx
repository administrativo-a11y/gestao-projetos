import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscreve a mudanças (INSERT/UPDATE/DELETE) em uma ou mais tabelas
 * e chama `onChange` (debounced) quando algo acontece. RLS no banco
 * já filtra o que cada usuário recebe, então não precisamos filtrar
 * todas as colunas aqui.
 *
 * @param {string} channelName  nome único do canal (ex: `tasks:${listId}`)
 * @param {Array<{table: string, filter?: string, event?: string}>} subscriptions
 * @param {Function} onChange   callback (recebe payload)
 * @param {number} debounceMs   debounce em ms (default 150)
 */
export function useRealtimeSync(channelName, subscriptions, onChange, debounceMs = 150) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!channelName || !subscriptions || subscriptions.length === 0) return

    let timer = null
    function trigger(payload) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        onChangeRef.current?.(payload)
      }, debounceMs)
    }

    let channel = supabase.channel(channelName)
    for (const sub of subscriptions) {
      const cfg = {
        event: sub.event ?? '*',
        schema: 'public',
        table: sub.table,
      }
      if (sub.filter) cfg.filter = sub.filter
      channel = channel.on('postgres_changes', cfg, trigger)
    }
    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subscriptions)])
}
