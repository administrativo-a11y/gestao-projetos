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

  // ── FETCH ──────────────────────────────────────────────────

  const fetchSpaces = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('spaces')
      .select('*, space_statuses(*)')
      .is('deleted_at', null)
      .order('created_at')
    setSpaces(data ?? [])
    setLoading(false)
  }, [user])

  const fetchFoldersAndLists = useCallback(async (spaceId) => {
    const [foldersRes, listsRes] = await Promise.all([
      supabase.from('folders').select('*').eq('space_id', spaceId).is('deleted_at', null).order('created_at'),
      supabase.from('lists').select('*, list_statuses(*)').eq('space_id', spaceId).is('deleted_at', null).order('created_at'),
    ])
    setFolders(foldersRes.data ?? [])
    setLists(listsRes.data ?? [])
  }, [])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  useEffect(() => {
    if (activeSpace) fetchFoldersAndLists(activeSpace.id)
    else { setFolders([]); setLists([]) }
  }, [activeSpace, fetchFoldersAndLists])

  // Realtime: espaços (sempre que mudam) + folders/lists do espaço ativo
  const spacesSubs = useMemo(() => user ? [
    { table: 'spaces' },
    { table: 'space_members' },
  ] : [], [user])
  useRealtimeSync(user ? `spaces:${user.id}` : null, spacesSubs, fetchSpaces)

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
      const statuses = useSpaceStatuses
        ? (activeSpace?.space_statuses ?? [])
        : [
            { name: 'A fazer', color: '#888780', position: 0 },
            { name: 'Em andamento', color: '#378ADD', position: 1 },
            { name: 'Concluído', color: '#1D9E75', position: 2 },
          ]
      if (statuses.length > 0) {
        await supabase.from('list_statuses').insert(
          statuses.map(s => ({ list_id: data.id, name: s.name, color: s.color, position: s.position }))
        )
      }
      await fetchFoldersAndLists(activeSpace.id)
    }
    return { data, error }
  }

  async function softDeleteList(id) {
    await supabase.from('lists').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (activeList?.id === id) setActiveList(null)
    await fetchFoldersAndLists(activeSpace.id)
    showUndo('Lista excluída', async () => {
      await supabase.from('lists').update({ deleted_at: null }).eq('id', id)
      await fetchFoldersAndLists(activeSpace.id)
    })
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

  return (
    <AppContext.Provider value={{
      spaces, activeSpace, setActiveSpace,
      folders, lists, activeList, selectList,
      expandedFolders, toggleFolder,
      loading,
      createSpace, softDeleteSpace,
      createFolder, softDeleteFolder,
      createList, softDeleteList,
      undoToast, handleUndo,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
