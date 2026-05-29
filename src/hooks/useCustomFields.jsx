import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeSync } from './useRealtimeSync'

export const FIELD_TYPES = [
  { id: 'text', label: 'Texto' },
  { id: 'number', label: 'Número' },
  { id: 'date', label: 'Data' },
  { id: 'select', label: 'Seleção' },
  { id: 'multi_select', label: 'Múltipla seleção' },
  { id: 'user', label: 'Pessoa' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'currency', label: 'Valor (R$)' },
  { id: 'url', label: 'URL' },
  { id: 'email', label: 'E-mail' },
  { id: 'phone', label: 'Telefone' },
]

export function useCustomFields(listId) {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    const { data } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('list_id', listId)
      .order('position')
    setFields(data ?? [])
    setLoading(false)
  }, [listId])

  useEffect(() => { refetch() }, [refetch])

  const subs = useMemo(() => listId ? [
    { table: 'custom_fields', filter: `list_id=eq.${listId}` },
  ] : [], [listId])
  useRealtimeSync(listId ? `custom-fields:${listId}` : null, subs, refetch)

  async function addField({ name, type, options = {} }) {
    setError('')
    const position = fields.length
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({ list_id: listId, name: name?.trim() || 'Novo campo', type, options, position })
      .select()
      .single()
    if (error) setError(error.message)
    return { data, error }
  }

  async function updateField(id, patch) {
    setError('')
    const { error } = await supabase.from('custom_fields').update(patch).eq('id', id)
    if (error) setError(error.message)
    return { error }
  }

  async function removeField(id) {
    setError('')
    const { error } = await supabase.from('custom_fields').delete().eq('id', id)
    if (error) setError(error.message)
    return { error }
  }

  async function reorder(orderedIds) {
    setError('')
    const updates = orderedIds.map((id, idx) =>
      supabase.from('custom_fields').update({ position: idx }).eq('id', id)
    )
    const results = await Promise.all(updates)
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) setError(firstErr.message)
    return { error: firstErr ?? null }
  }

  return { fields, loading, error, addField, updateField, removeField, reorder, refetch }
}
