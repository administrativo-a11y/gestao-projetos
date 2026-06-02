import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRealtimeSync } from './useRealtimeSync'

const AppContext = createContext(null)

// Chaves de localStorage para lembrar onde o usuário estava.
const LAST_SPACE_KEY = 'gp.last_space_id'
const LAST_LIST_KEY = (spaceId) => `gp.last_list_id.${spaceId}`

function safeGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function AppProvider({ children }) {
  const { user } = useAuth()

  const [spaces, setSpaces] = useState([])
  const [activeSpace, setActiveSpaceState] = useState(null)
  const [folders, setFolders] = useState([])
  const [lists, setLists] = useState([])
  const [activeList, setActiveListState] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [undoToast, setUndoToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // ── FETCH ──────────────────────────────────────────────────

  const fetchSpaces = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('spaces')
      .select('*, space_statuses(*)')
      .is('deleted_at', null)
      .order('created_at')
    setSpaces(data ?? [])
    setLoading(false)
  }, [user?.id])

  const fetchFoldersAndLists = useCallback(async (spaceId) => {
    const [foldersRes, listsRes] = await Promise.all([
      supabase
        .from('folders').select('*')
        .eq('space_id', spaceId).is('deleted_at', null)
        .order('position').order('created_at'),
      supabase
        .from('lists').select('*, list_statuses(*)')
        .eq('space_id', spaceId).is('deleted_at', null)
        .order('position').order('created_at'),
    ])
    setFolders(foldersRes.data ?? [])
    setLists(listsRes.data ?? [])
  }, [])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  useEffect(() => {
    if (activeSpace?.id) fetchFoldersAndLists(activeSpace.id)
    else { setFolders([]); setLists([]) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpace?.id])

  // Realtime: espaços (sempre que mudam) + folders/lists do espaço ativo
  const spacesSubs = useMemo(() => user?.id ? [
    { table: 'spaces' },
    { table: 'space_members' },
  ] : [], [user?.id])
  useRealtimeSync(user?.id ? `spaces:${user.id}` : null, spacesSubs, fetchSpaces)

  const treeSubs = useMemo(() => activeSpace ? [
    { table: 'folders', filter: `space_id=eq.${activeSpace.id}` },
    { table: 'lists', filter: `space_id=eq.${activeSpace.id}` },
  ] : [], [activeSpace?.id])
  useRealtimeSync(
    activeSpace ? `tree:${activeSpace.id}` : null,
    treeSubs,
    () => activeSpace && fetchFoldersAndLists(activeSpace.id)
  )

  // ── SPACE ──────────────────────────────────────────────────

  async function setActiveSpace(sp) {
    setActiveSpaceState(sp)
    setActiveListState(null)
    setExpandedFolders({})
    if (sp?.id) safeSet(LAST_SPACE_KEY, sp.id)
  }

  // Wrapper que persiste a última lista por espaço
  function setActiveList(list) {
    setActiveListState(list)
    if (list?.id && activeSpace?.id) {
      safeSet(LAST_LIST_KEY(activeSpace.id), list.id)
    }
  }

  // Restaurar último espaço quando os espaços terminam de carregar
  // e o usuário está na home (sem espaço na URL).
  useEffect(() => {
    if (loading) return
    if (activeSpace) return
    if (spaces.length === 0) return
    const path = window.location.pathname
    if (path.startsWith('/space/')) return // URL já indica espaço; sync de App.jsx cuida
    const savedId = safeGet(LAST_SPACE_KEY)
    if (!savedId) return
    const sp = spaces.find(s => s.id === savedId)
    if (sp) setActiveSpaceState(sp)
  }, [loading, spaces, activeSpace])

  // Restaurar última lista do espaço quando as listas carregam
  // e a URL não indica uma lista específica.
  useEffect(() => {
    if (!activeSpace) return
    if (activeList) return
    if (lists.length === 0) return
    const path = window.location.pathname
    if (path.includes('/list/')) return // URL já indica lista
    const savedId = safeGet(LAST_LIST_KEY(activeSpace.id))
    if (!savedId) return
    const li = lists.find(l => l.id === savedId)
    if (li) setActiveListState(li)
  }, [activeSpace, lists, activeList])

  async function createSpace({ name, color }) {
    const { data, error } = await supabase
      .from('spaces')
      .insert({ name, color, owner_id: user.id })
      .select('*, space_statuses(*)')
      .single()
    if (!error) {
      await fetchSpaces()
      setActiveSpaceState(data)
    }
    return { data, error }
  }

  async function updateSpace(id, patch) {
    const { error } = await supabase.from('spaces').update(patch).eq('id', id)
    if (!error) {
      await fetchSpaces()
      // Mantém o activeSpace atualizado
      if (activeSpace?.id === id) {
        setActiveSpaceState(prev => prev ? { ...prev, ...patch } : prev)
      }
    }
    return { error }
  }

  async function softDeleteSpace(id) {
    await supabase.from('spaces').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (activeSpace?.id === id) { setActiveSpaceState(null); setActiveList(null) }
    await fetchSpaces()
    showUndo('Espaço excluído', async () => {
      await supabase.from('spaces').update({ deleted_at: null }).eq('id', id)
      await fetchSpaces()
    })
  }

  // ── FOLDER ─────────────────────────────────────────────────

  async function createFolder({ name }) {
    const { data, error } = await supabase
      .from('folders')
      .insert({ space_id: activeSpace.id, name })
      .select()
      .single()
    if (!error) await fetchFoldersAndLists(activeSpace.id)
    return { data, error }
  }

  async function updateFolder(id, patch) {
    const { error } = await supabase.from('folders').update(patch).eq('id', id)
    if (!error) await fetchFoldersAndLists(activeSpace.id)
    return { error }
  }

  async function softDeleteFolder(id) {
    await supabase.from('folders').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    await fetchFoldersAndLists(activeSpace.id)
    showUndo('Pasta excluída', async () => {
      await supabase.from('folders').update({ deleted_at: null }).eq('id', id)
      await fetchFoldersAndLists(activeSpace.id)
    })
  }

  // ── LIST ───────────────────────────────────────────────────

  async function createList({ name, folderId = null, useSpaceStatuses = true }) {
    const { data, error } = await supabase
      .from('lists')
      .insert({ space_id: activeSpace.id, folder_id: folderId ?? null, name })
      .select()
      .single()

    if (!error && data) {
      let statuses = []
      if (useSpaceStatuses) {
        // Busca direto do banco pra pegar o estado atual (não o cache em memória,
        // que pode estar desatualizado se o user editou status há pouco)
        const { data: rows } = await supabase
          .from('space_statuses')
          .select('name, color, position, category')
          .eq('space_id', activeSpace.id)
          .order('position')
        statuses = rows ?? []
      } else {
        statuses = [
          { name: 'TO START',     color: '#888780', position: 0, category: 'open' },
          { name: 'IN PROGRESS',  color: '#378ADD', position: 1, category: 'open' },
          { name: 'DONE',         color: '#1D9E75', position: 2, category: 'open' },
        ]
      }
      if (statuses.length > 0) {
        await supabase.from('list_statuses').insert(
          statuses.map(s => ({
            list_id: data.id,
            name: s.name,
            color: s.color,
            position: s.position,
            category: s.category ?? 'open',
          }))
        )
      }
      await fetchFoldersAndLists(activeSpace.id)
    }
    return { data, error }
  }

  async function updateList(id, patch) {
    const { error } = await supabase.from('lists').update(patch).eq('id', id)
    if (!error) {
      await fetchFoldersAndLists(activeSpace.id)
      if (activeList?.id === id) {
        setActiveListState(prev => prev ? { ...prev, ...patch } : prev)
      }
    }
    return { error }
  }

  async function softDeleteList(id) {
    await supabase.from('lists').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (activeList?.id === id) setActiveListState(null)
    await fetchFoldersAndLists(activeSpace.id)
    showUndo('Lista excluída', async () => {
      await supabase.from('lists').update({ deleted_at: null }).eq('id', id)
      await fetchFoldersAndLists(activeSpace.id)
    })
  }

  async function archiveList(id) {
    await supabase.from('lists').update({ archived_at: new Date().toISOString() }).eq('id', id)
    if (activeList?.id === id) setActiveListState(null)
    await fetchFoldersAndLists(activeSpace.id)
    showUndo('Lista arquivada', async () => {
      await supabase.from('lists').update({ archived_at: null }).eq('id', id)
      await fetchFoldersAndLists(activeSpace.id)
    })
  }

  async function unarchiveList(id) {
    await supabase.from('lists').update({ archived_at: null }).eq('id', id)
    await fetchFoldersAndLists(activeSpace.id)
  }

  async function archiveFolder(id) {
    await supabase.from('folders').update({ archived_at: new Date().toISOString() }).eq('id', id)
    await fetchFoldersAndLists(activeSpace.id)
    showUndo('Pasta arquivada', async () => {
      await supabase.from('folders').update({ archived_at: null }).eq('id', id)
      await fetchFoldersAndLists(activeSpace.id)
    })
  }

  async function unarchiveFolder(id) {
    await supabase.from('folders').update({ archived_at: null }).eq('id', id)
    await fetchFoldersAndLists(activeSpace.id)
  }

  async function duplicateList(id) {
    const { data, error } = await supabase.rpc('duplicate_list', { p_list_id: id })
    if (!error) await fetchFoldersAndLists(activeSpace.id)
    return { newListId: data, error }
  }

  async function duplicateFolder(id) {
    const { data, error } = await supabase.rpc('duplicate_folder', { p_folder_id: id })
    if (!error) await fetchFoldersAndLists(activeSpace.id)
    return { newFolderId: data, error }
  }

  // Atualiza position de várias pastas em lote (idx 0..n-1 conforme ordem)
  async function reorderFolders(orderedIds) {
    // Optimistic: reordena state local instantaneamente
    setFolders(prev => {
      const map = new Map(prev.map(f => [f.id, f]))
      const reordered = orderedIds.map((id, idx) => map.get(id) ? { ...map.get(id), position: idx } : null).filter(Boolean)
      const others = prev.filter(f => !orderedIds.includes(f.id))
      return [...reordered, ...others]
    })
    const updates = orderedIds.map((id, idx) =>
      supabase.from('folders').update({ position: idx }).eq('id', id)
    )
    await Promise.all(updates)
    if (activeSpace) await fetchFoldersAndLists(activeSpace.id)
  }

  // Atualiza position de várias listas (mesmo escopo: mesma pasta ou raiz)
  async function reorderLists(orderedIds) {
    setLists(prev => {
      const map = new Map(prev.map(l => [l.id, l]))
      const reordered = orderedIds.map((id, idx) => map.get(id) ? { ...map.get(id), position: idx } : null).filter(Boolean)
      const others = prev.filter(l => !orderedIds.includes(l.id))
      return [...reordered, ...others]
    })
    const updates = orderedIds.map((id, idx) =>
      supabase.from('lists').update({ position: idx }).eq('id', id)
    )
    await Promise.all(updates)
    if (activeSpace) await fetchFoldersAndLists(activeSpace.id)
  }

  // ── SIDEBAR ────────────────────────────────────────────────

  function toggleFolder(folderId) {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  function selectList(list) { setActiveList(list) }

  // ── UNDO ───────────────────────────────────────────────────

  function showUndo(message, onUndo) {
    if (undoToast?.timer) clearTimeout(undoToast.timer)
    const timer = setTimeout(() => setUndoToast(null), 5000)
    setUndoToast({ message, onUndo, timer })
  }

  async function handleUndo() {
    if (!undoToast) return
    clearTimeout(undoToast.timer)
    await undoToast.onUndo()
    setUndoToast(null)
  }

  // Listas/pastas visíveis na sidebar — filtradas por archived conforme toggle.
  // deleted_at já é filtrado na query, então só falta archived_at.
  const visibleFolders = useMemo(
    () => folders.filter(f => showArchived ? true : !f.archived_at),
    [folders, showArchived]
  )
  const visibleLists = useMemo(
    () => lists.filter(l => showArchived ? true : !l.archived_at),
    [lists, showArchived]
  )

  return (
    <AppContext.Provider value={{
      spaces, activeSpace, setActiveSpace,
      folders, lists, activeList, selectList,
      visibleFolders, visibleLists,
      showArchived, setShowArchived,
      expandedFolders, toggleFolder,
      loading,
      createSpace, updateSpace, softDeleteSpace,
      createFolder, updateFolder, softDeleteFolder,
      createList, updateList, softDeleteList,
      archiveList, unarchiveList, archiveFolder, unarchiveFolder,
      duplicateList, duplicateFolder,
      reorderFolders, reorderLists,
      undoToast, handleUndo,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
