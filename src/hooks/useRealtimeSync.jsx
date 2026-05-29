import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Contador global pra garantir nome de canal único por instância do hook.
// Sem isso, dois componentes chamando useRealtimeSync('tasks:X', ...)
// pegariam o mesmo canal — quando o segundo tentasse `.on()` após o
// `.subscribe()` do primeiro, o Supabase lançaria
// "cannot add postgres_changes callbacks after subscribe()".
let counter = 0

/**
 * Subscreve a mudanças (INSERT/UPDATE/DELETE) em uma ou mais tabelas
 * e chama `onChange` (debounced) quando algo acontece. RLS no banco
 * já filtra o que cada usuário recebe.
 *
 * @param {string} channelKey   identificador semântico (ex: `tasks:${listId}`)
 *                              — apenas para debug; o canal real ganha sufixo único.
 * @param {Array<{table: string, filter?: string, event?: string}>} subscriptions
 * @param {Function} onChange   callback (recebe payload)
 * @param {number} debounceMs   debounce em ms (default 150)
 */
export function useRealtimeSync(channelKey, subscriptions, onChange, debounceMs = 150) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Sufixo único por instância — sobrevive a re-renders, recria após cleanup
  const instanceIdRef = useRef(null)
  if (instanceIdRef.current === null) {
    instanceIdRef.current = `${++counter}-${Math.random().toString(36).slice(2, 8)}`
  }

  useEffect(() => {
    if (!channelKey || !subscriptions || subscriptions.length === 0) return

    let timer = null
    function trigger(payload) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        onChangeRef.current?.(payload)
      }, debounceMs)
    }

    const fullName = `${channelKey}#${instanceIdRef.current}`
    let channel
    try {
      channel = supabase.channel(fullName)
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
    } catch (err) {
      // Não derruba a UI se algo der errado com realtime.
      // eslint-disable-next-line no-console
      console.warn('[realtime] falha ao subscrever canal', fullName, err)
    }

    return () => {
      if (timer) clearTimeout(timer)
      if (channel) {
        try { supabase.removeChannel(channel) } catch { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, JSON.stringify(subscriptions)])
}
