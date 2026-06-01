import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import UndoToast from '../components/shared/UndoToast'
import SearchModal from '../components/shared/SearchModal'
import NotificationBell from '../components/shared/NotificationBell'
import BoardView from '../components/board/BoardView'
import ListView from '../components/list/ListView'
import DashboardView from '../components/dashboard/DashboardView'
import GanttView from '../components/gantt/GanttView'
import FilterBar from '../components/filters/FilterBar'
import SavedViewsMenu from '../components/filters/SavedViewsMenu'
import { useApp } from '../hooks/useApp'
import styles from './App.module.css'

const VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'Lista' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'dashboard', label: 'Painel' },
]

const VIEW_KEY = (listId) => `gp.last_view.${listId}`
const VALID_VIEWS = VIEWS.map(v => v.id)
const SIDEBAR_WIDTH_KEY = 'gp.sidebar_width'
const SIDEBAR_COLLAPSED_KEY = 'gp.sidebar_collapsed'
const MIN_WIDTH = 200
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 260

function safeGet(key) { try { return localStorage.getItem(key) } catch { return null } }
function safeSet(key, value) { try { localStorage.setItem(key, value) } catch { /* ignore */ } }

function loadViewFor(listId) {
  const v = safeGet(VIEW_KEY(listId))
  return VALID_VIEWS.includes(v) ? v : null
}
function saveViewFor(listId, view) { safeSet(VIEW_KEY(listId), view) }

function loadSidebarWidth() {
  const n = parseInt(safeGet(SIDEBAR_WIDTH_KEY) ?? '', 10)
  return Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH ? n : DEFAULT_WIDTH
}
function loadSidebarCollapsed() {
  return safeGet(SIDEBAR_COLLAPSED_KEY) === '1'
}

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

export default function AppPage() {
  const { spaceId, listId } = useParams()
  const navigate = useNavigate()
  const {
    spaces, lists, folders, activeList, activeSpace,
    setActiveSpace, selectList, updateList,
  } = useApp()
  const activeFolder = activeList?.folder_id
    ? folders.find(f => f.id === activeList.folder_id) ?? null
    : null

  // Controle de exibição da descrição da lista (compartilhado com ListView via localStorage).
  // O ListView monta esse mesmo flag; aqui mantemos uma cópia pra refletir no botão do topbar.
  const [listDescHidden, setListDescHidden] = useState(false)
  useEffect(() => {
    if (!activeList?.id) { setListDescHidden(false); return }
    try {
      const v = localStorage.getItem(`gp.list_desc_hidden.${activeList.id}`)
      setListDescHidden(v === '1')
    } catch { setListDescHidden(false) }
  }, [activeList?.id])
  useEffect(() => {
    function onStorage(e) {
      if (!activeList?.id) return
      if (e.key !== `gp.list_desc_hidden.${activeList.id}`) return
      setListDescHidden(e.newValue === '1')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [activeList?.id])

  function toggleListDescriptionVisibility() {
    if (!activeList?.id) return
    setListDescHidden(prev => {
      const next = !prev
      try { localStorage.setItem(`gp.list_desc_hidden.${activeList.id}`, next ? '1' : '0') } catch { /* ignore */ }
      window.dispatchEvent(new StorageEvent('storage', {
        key: `gp.list_desc_hidden.${activeList.id}`,
        newValue: next ? '1' : '0',
      }))
      return next
    })
  }

  async function startListDescription() {
    if (!activeList?.id) return
    // Garante visibilidade e abre modo edição via storage event customizado
    try { localStorage.setItem(`gp.list_desc_hidden.${activeList.id}`, '0') } catch { /* ignore */ }
    setListDescHidden(false)
    window.dispatchEvent(new CustomEvent('gp:list_desc_edit', { detail: { listId: activeList.id } }))
  }
  const [editingListName, setEditingListName] = useState(false)
  const [draftListName, setDraftListName] = useState('')
  const [activeView, setActiveViewState] = useState('board')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth)
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(loadSidebarCollapsed)

  function setSidebarCollapsed(v) {
    setSidebarCollapsedState(v)
    safeSet(SIDEBAR_COLLAPSED_KEY, v ? '1' : '0')
  }

  // Restaurar view ao trocar de lista
  useEffect(() => {
    if (!activeList) return
    const saved = loadViewFor(activeList.id)
    setActiveViewState(saved ?? 'board')
  }, [activeList?.id])

  function setActiveView(next) {
    setActiveViewState(next)
    if (activeList?.id) saveViewFor(activeList.id, next)
  }

  // URL → state
  useEffect(() => {
    if (!spaceId) return
    if (spaces.length === 0) return
    if (activeSpace?.id === spaceId) return
    const sp = spaces.find(s => s.id === spaceId)
    if (sp) setActiveSpace(sp)
  }, [spaceId, spaces, activeSpace?.id, setActiveSpace])

  useEffect(() => {
    if (!listId) return
    if (lists.length === 0) return
    if (activeList?.id === listId) return
    const li = lists.find(l => l.id === listId)
    if (li) selectList(li)
  }, [listId, lists, activeList?.id, selectList])

  useEffect(() => {
    const search = window.location.search
    if (!activeSpace) {
      if (spaceId) navigate({ pathname: '/', search }, { replace: true })
      return
    }
    const want = activeList
      ? `/space/${activeSpace.id}/list/${activeList.id}`
      : `/space/${activeSpace.id}`
    if (window.location.pathname !== want) {
      navigate({ pathname: want, search }, { replace: true })
    }
  }, [activeSpace, activeList])

  // Atalho Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Resize da sidebar
  const dragRef = useRef(null)
  const startResize = useCallback((e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: sidebarWidth }

    function onMove(ev) {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      let next = dragRef.current.startW + delta
      if (next < MIN_WIDTH) next = MIN_WIDTH
      if (next > MAX_WIDTH) next = MAX_WIDTH
      setSidebarWidth(next)
    }
    function onUp() {
      if (dragRef.current) {
        safeSet(SIDEBAR_WIDTH_KEY, String(dragRef.current.startW))
        // salva valor final
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      dragRef.current = null
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
  }, [sidebarWidth])

  // Persistir width após cada mudança (debounced via setTimeout)
  const widthSaveTimer = useRef(null)
  useEffect(() => {
    if (widthSaveTimer.current) clearTimeout(widthSaveTimer.current)
    widthSaveTimer.current = setTimeout(() => {
      safeSet(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
    }, 300)
    return () => widthSaveTimer.current && clearTimeout(widthSaveTimer.current)
  }, [sidebarWidth])

  return (
    <div className={styles.layout}>
      <header className={styles.globalTopbar}>
        <button
          className={styles.iconBtn}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Mostrar sidebar' : 'Ocultar sidebar'}
          aria-label="Alternar sidebar"
        >
          <MenuIcon />
        </button>

        <div className={styles.globalSpacer} />

        <button
          className={styles.searchTrigger}
          onClick={() => setSearchOpen(true)}
          title="Buscar (Ctrl+K)"
        >
          <SearchIcon />
          <span>Pesquisar</span>
          <kbd className={styles.kbd}>Ctrl+K</kbd>
        </button>

        <div className={styles.globalSpacer} />

        <NotificationBell />
      </header>

      <div className={styles.body}>
        <div
          className={`${styles.sidebarWrap} ${sidebarCollapsed ? styles.collapsed : ''}`}
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        >
          <div className={styles.sidebarInner} style={{ width: sidebarWidth }}>
            <Sidebar />
          </div>
          {!sidebarCollapsed && (
            <div
              className={styles.resizeHandle}
              onMouseDown={startResize}
              role="separator"
              aria-orientation="vertical"
              title="Arrastar para redimensionar"
            />
          )}
        </div>

        <div className={styles.main}>
          {activeList ? (
            <>
              <header className={styles.topbar}>
                <div className={styles.topbarLeft}>
                  <nav className={styles.breadcrumb} aria-label="Caminho">
                    {activeSpace && (
                      <>
                        <span className={styles.crumb} title={activeSpace.name}>
                          {activeSpace.icon && <span className={styles.crumbIcon}>{activeSpace.icon}</span>}
                          <span className={styles.crumbText}>{activeSpace.name}</span>
                        </span>
                        <span className={styles.crumbSep} aria-hidden="true">/</span>
                      </>
                    )}
                    {activeFolder && (
                      <>
                        <span className={styles.crumb} title={activeFolder.name}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className={styles.crumbIconSvg}>
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                          <span className={styles.crumbText}>{activeFolder.name}</span>
                        </span>
                        <span className={styles.crumbSep} aria-hidden="true">/</span>
                      </>
                    )}
                    <span className={styles.crumbCurrent}>
                      {editingListName ? (
                        <input
                          type="text"
                          autoFocus
                          className={styles.listNameInput}
                          value={draftListName}
                          onChange={e => setDraftListName(e.target.value)}
                          onBlur={async () => {
                            const name = draftListName.trim()
                            if (name && name !== activeList.name) await updateList(activeList.id, { name })
                            setEditingListName(false)
                          }}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                            if (e.key === 'Escape') { e.preventDefault(); setEditingListName(false) }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.listName}
                          onClick={() => { setDraftListName(activeList.name); setEditingListName(true) }}
                          title="Clique para renomear"
                        >
                          {activeList.name}
                        </button>
                      )}
                    </span>
                  </nav>
                  {activeList.description ? (
                    <button
                      type="button"
                      className={styles.descBtn}
                      onClick={toggleListDescriptionVisibility}
                      title={listDescHidden ? 'Mostrar descrição' : 'Ocultar descrição'}
                      aria-label={listDescHidden ? 'Mostrar descrição' : 'Ocultar descrição'}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <line x1="8" y1="6" x2="21" y2="6"/>
                        <line x1="8" y1="12" x2="21" y2="12"/>
                        <line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/>
                        <line x1="3" y1="12" x2="3.01" y2="12"/>
                        <line x1="3" y1="18" x2="3.01" y2="18"/>
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.descBtn}
                      onClick={startListDescription}
                      title="Adicionar descrição à lista"
                      aria-label="Adicionar descrição"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  )}
                </div>
                <nav className={styles.tabs}>
                  {VIEWS.map(v => (
                    <button
                      key={v.id}
                      className={`${styles.tab} ${activeView === v.id ? styles.tabActive : ''}`}
                      onClick={() => setActiveView(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </nav>
                <div className={styles.topbarRight}>
                  <SavedViewsMenu currentView={activeView} setView={setActiveView} />
                </div>
              </header>
              {activeView !== 'dashboard' && <FilterBar />}
              <div className={styles.content}>
                {activeView === 'board' && <BoardView />}
                {activeView === 'list' && <ListView />}
                {activeView === 'gantt' && <GanttView />}
                {activeView === 'dashboard' && <DashboardView />}
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyInner}>
                <div className={styles.emptyDot} />
                <h2 className={styles.emptyTitle}>
                  {activeSpace ? 'Selecione uma lista' : 'Selecione um espaço'}
                </h2>
                <p className={styles.emptyText}>
                  {activeSpace
                    ? 'Escolha uma lista na sidebar para ver as tarefas.'
                    : 'Clique no nome do espaço na sidebar para selecionar ou criar.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <UndoToast />
    </div>
  )
}
