import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Busca global. RLS no banco filtra automaticamente — usuário só recebe
 * o que pode ver.
 *
 * Retorna agrupado por tipo: tasks, lists, folders, spaces.
 */
export function useGlobalSearch(query, options = {}) {
  const { limit = 8, minChars = 2 } = options
  const [results, setResults] = useState({ tasks: [], lists: [], folders: [], spaces: [] })
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query?.trim() ?? ''
    if (q.length < minChars) {
      setResults({ tasks: [], lists: [], folders: [], spaces: [] })
      setLoading(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const like = `%${q.replace(/[%_]/g, m => '\\' + m)}%`
      const [tasksRes, listsRes, foldersRes, spacesRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, list_id, lists(name, space_id, spaces(name, color))')
          .ilike('title', like)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(limit),
        supabase
          .from('lists')
          .select('id, name, color, space_id, folder_id, spaces(name, color), folders(name)')
          .ilike('name', like)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(limit),
        supabase
          .from('folders')
          .select('id, name, color, space_id, spaces(name, color)')
          .ilike('name', like)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(limit),
        supabase
          .from('spaces')
          .select('id, name, color')
          .ilike('name', like)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(limit),
      ])

      setResults({
        tasks: tasksRes.data ?? [],
        lists: listsRes.data ?? [],
        folders: foldersRes.data ?? [],
        spaces: spacesRes.data ?? [],
      })
      setLoading(false)
    }, 200)

    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [query, limit, minChars])

  const total =
    results.tasks.length + results.lists.length + results.folders.length + results.spaces.length

  return { results, loading, total }
}
