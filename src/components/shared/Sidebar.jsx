import { useState, useRef, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../hooks/useApp'
import { useTheme } from '../../hooks/useTheme'
import ProfileModal from './ProfileModal'
import ContextMenu from './ContextMenu'
import ReleaseNotesModal from './ReleaseNotesModal'
import SpaceSettingsModal from '../space/SpaceSettingsModal'
import FolderPermissionsPanel from '../folder/FolderPermissionsPanel'
import ImportModal from '../import/ImportModal'
import { CURRENT_VERSION } from '../../data/releases'
import { supabase } from '../../lib/supabase'
import styles from './Sidebar.module.css'

const COLORS = ['#1D9E75','#378ADD','#EF9F27','#7F77DD','#E24B4A','#D4537E']

const Chevron = ({ open, size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }} aria-hidden="true">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const Plus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const Trash = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const FolderOpenIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v1H3V7z"/>
    <path d="M3 11h18l-2 8a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5L3 11z"/>
  </svg>
)

const ImportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

const ListIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

const Lock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const Dots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
  </svg>
)

const GripIcon = () => (
  <svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5" r="1.4"/>
    <circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/>
    <circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="19" r="1.4"/>
  </svg>
)

const Copy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const Archive = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
)

const Unarchive = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><polyline points="10 15 12 13 14 15"/><line x1="12" y1="13" x2="12" y2="20"/>
  </svg>
)

const Eye = ({ on = true }) => on ? (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.77 19.77 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const { preference: themePref, setTheme } = useTheme()
  const {
    spaces, activeSpace, setActiveSpace,
    visibleFolders, visibleLists, activeList, selectList,
    showArchived, setShowArchived,
    expandedFolders, toggleFolder,
    createSpace, updateSpace, softDeleteSpace,
    createFolder, updateFolder, softDeleteFolder,
    createList, updateList, softDeleteList,
    archiveList, unarchiveList, archiveFolder, unarchiveFolder,
    duplicateList, duplicateFolder,
    reorderFolders, reorderLists,
  } = useApp()

  const [spaceDropdown, setSpaceDropdown] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSpaceSettings, setShowSpaceSettings] = useState(false)
  const [permissionsFolder, setPermissionsFolder] = useState(null)
  const [showReleases, setShowReleases] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importTarget, setImportTarget] = useState(null) // null | { type: 'folder'|'list', id }

  function openImport(target = null) {
    setImportTarget(target)
    setShowImport(true)
  }
  function closeImport() {
    setShowImport(false)
    setImportTarget(null)
  }

  async function handleApplySpaceStatuses(listId, listName) {
    const ok = confirm(
      `Aplicar os status do espaço na lista "${listName}"?\n\n` +
      `Os status atuais da lista serão SUBSTITUÍDOS pelos do espaço. ` +
      `Tarefas que estavam nesses status ficarão temporariamente sem status — ` +
      `você pode reatribuir clicando na bolinha de cada uma.`
    )
    if (!ok) return
    const { data, error } = await supabase.rpc('apply_space_statuses_to_list', { p_list_id: listId })
    if (error) {
      alert(`Falha: ${error.message}\n\nA função pode não ter sido instalada no banco — rode supabase_schema_v15.sql.`)
      return
    }
    alert(`${data} status aplicados à lista "${listName}". Recarregando...`)
    window.location.reload()
  }
  const [lastSeenVersion, setLastSeenVersion] = useState(() => {
    try { return localStorage.getItem('gp.last_seen_version') } catch { return null }
  })
  // editingId: { kind: 'space'|'folder'|'list', id, draft }
  const [editingId, setEditingId] = useState(null)
  const hasNewRelease = lastSeenVersion !== CURRENT_VERSION

  function openReleases() {
    setShowReleases(true)
    try { localStorage.setItem('gp.last_seen_version', CURRENT_VERSION) } catch { /* ignore */ }
    setLastSeenVersion(CURRENT_VERSION)
  }
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', color: COLORS[0], useSpaceStatuses: true, folderId: null })
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const dropdownRef = useRef(null)
  const userMenuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setSpaceDropdown(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openModal(type, extra = {}) {
    setForm({ name: '', color: COLORS[0], useSpaceStatuses: true, folderId: null, ...extra })
    setCreateError('')
    setModal(type)
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    setCreateError('')
    let result
    if (modal === 'space') result = await createSpace({ name: form.name, color: form.color })
    if (modal === 'folder') result = await createFolder({ name: form.name })
    if (modal === 'list') result = await createList({ name: form.name, folderId: form.folderId, useSpaceStatuses: form.useSpaceStatuses })
    setSaving(false)
    if (result?.error) {
      const msg = result.error.message || String(result.error)
      // Mensagem mais amigável pra RLS
      const friendly = msg.includes('row-level security') || msg.includes('permission denied')
        ? 'Você não tem permissão para criar isso neste espaço. Peça ao owner/admin para promover seu papel a "member" ou superior.'
        : msg
      setCreateError(friendly)
      return
    }
    setModal(null)
  }

  function getInitials(name) {
    return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  function startEditing(kind, id, currentName) {
    setEditingId({ kind, id, draft: currentName })
  }

  async function commitEditing() {
    if (!editingId) return
    const name = editingId.draft.trim()
    if (!name) { setEditingId(null); return }
    if (editingId.kind === 'space') await updateSpace(editingId.id, { name })
    if (editingId.kind === 'folder') await updateFolder(editingId.id, { name })
    if (editingId.kind === 'list') await updateList(editingId.id, { name })
    setEditingId(null)
  }

  function isEditing(kind, id) {
    return editingId?.kind === kind && editingId?.id === id
  }

  function RenameInput({ kind, id }) {
    return (
      <input
        type="text"
        autoFocus
        value={editingId.draft}
        onChange={e => setEditingId(s => ({ ...s, draft: e.target.value }))}
        onBlur={commitEditing}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commitEditing() }
          if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
        }}
        onClick={e => e.stopPropagation()}
        className={styles.renameInput}
      />
    )
  }

  // Listas sem pasta (direto no espaço)
  const rootLists = visibleLists.filter(l => !l.folder_id)

  // Drag-drop pra reordenar
  function handleDragEnd(result) {
    const { source, destination, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    if (type === 'folder') {
      const ids = visibleFolders.map(f => f.id)
      const [moved] = ids.splice(source.index, 1)
      ids.splice(destination.index, 0, moved)
      reorderFolders(ids)
      return
    }

    if (type === 'list' && source.droppableId === destination.droppableId) {
      let scope
      if (source.droppableId === 'root-lists') {
        scope = rootLists.map(l => l.id)
      } else if (source.droppableId.startsWith('folder-') && source.droppableId.endsWith('-lists')) {
        const folderId = source.droppableId.slice('folder-'.length, -'-lists'.length)
        scope = visibleLists.filter(l => l.folder_id === folderId).map(l => l.id)
      } else {
        return
      }
      const [moved] = scope.splice(source.index, 1)
      scope.splice(destination.index, 0, moved)
      reorderLists(scope)
    }
  }

  return (
    <>
      <aside className={styles.sidebar}>

        {/* Dropdown de espaço — canto superior esquerdo */}
        <div className={styles.spaceBar} ref={dropdownRef}>
          <div className={styles.spaceRow}>
            <button className={styles.spaceSelector} onClick={() => !isEditing('space', activeSpace?.id) && setSpaceDropdown(v => !v)}>
              {activeSpace ? (
                <>
                  <span className={styles.spaceIcon} style={{ background: activeSpace.color }}>
                    {activeSpace.name[0].toUpperCase()}
                  </span>
                  {isEditing('space', activeSpace.id) ? (
                    <RenameInput kind="space" id={activeSpace.id} />
                  ) : (
                    <span className={styles.spaceName}>{activeSpace.name}</span>
                  )}
                </>
              ) : (
                <>
                  <span className={styles.spaceIconEmpty}>?</span>
                  <span className={styles.spaceNameEmpty}>Selecionar espaço</span>
                </>
              )}
              <Chevron open={spaceDropdown} />
            </button>

            {activeSpace && (
              <div className={styles.spaceActions}>
                <ContextMenu
                  trigger={
                    <button className={styles.iconBtn} aria-label="Ações do espaço" title="Mais">
                      <Dots />
                    </button>
                  }
                  items={[
                    { label: 'Renomear', onClick: () => startEditing('space', activeSpace.id, activeSpace.name) },
                    { label: 'Configurações do espaço', onClick: () => setShowSpaceSettings(true) },
                    { label: 'Importar...', icon: <ImportIcon />, onClick: () => openImport(null) },
                    { separator: true },
                    {
                      label: showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados',
                      icon: <Eye on={!showArchived} />,
                      onClick: () => setShowArchived(v => !v),
                    },
                    { separator: true },
                    { label: 'Excluir espaço', icon: <Trash />, danger: true, onClick: () => softDeleteSpace(activeSpace.id) },
                  ]}
                />
                <ContextMenu
                  trigger={
                    <button className={styles.iconBtn} aria-label="Criar" title="Criar">
                      <Plus />
                    </button>
                  }
                  items={[
                    { label: 'Lista', icon: <ListIcon />, onClick: () => openModal('list', { folderId: null }) },
                    { label: 'Pasta', icon: <FolderIcon />, onClick: () => openModal('folder') },
                  ]}
                />
              </div>
            )}
          </div>

          {spaceDropdown && (
            <div className={styles.spaceDropdown}>
              <div className={styles.dropdownHeader}>Espaços</div>
              {spaces.map(sp => (
                <div key={sp.id} className={styles.dropdownRow}>
                  <button
                    className={`${styles.dropdownItem} ${activeSpace?.id === sp.id ? styles.dropdownActive : ''}`}
                    onClick={() => { setActiveSpace(sp); setSpaceDropdown(false) }}
                  >
                    <span className={styles.spaceIcon} style={{ background: sp.color, width: 22, height: 22, fontSize: 11 }}>
                      {sp.name[0].toUpperCase()}
                    </span>
                    {sp.name}
                  </button>
                </div>
              ))}
              <button className={styles.dropdownNew} onClick={() => { setSpaceDropdown(false); openModal('space') }}>
                <Plus /> Novo espaço
              </button>
            </div>
          )}
        </div>

        {/* Conteúdo do espaço ativo */}
        {activeSpace ? (
          <>
            <DragDropContext onDragEnd={handleDragEnd}>
            <nav className={styles.tree}>
              {/* Pastas */}
              <Droppable droppableId="root-folders" type="folder">
              {(__provFolders) => (
              <div ref={__provFolders.innerRef} {...__provFolders.droppableProps}>
              {visibleFolders.map((folder, __fIdx) => {
                const folderLists = visibleLists.filter(l => l.folder_id === folder.id)
                const isOpen = expandedFolders[folder.id]
                const isArchived = !!folder.archived_at
                return (
                  <Draggable key={folder.id} draggableId={`folder-${folder.id}`} index={__fIdx}>
                  {(__dpF, __snapF) => (
                  <div
                    ref={__dpF.innerRef}
                    {...__dpF.draggableProps}
                    className={`${isArchived ? styles.archivedItem : ''} ${__snapF.isDragging ? styles.dragging : ''}`}
                  >
                    <div className={styles.treeRow}>
                      <span className={styles.dragHandle} {...__dpF.dragHandleProps} aria-label="Arrastar pasta" title="Arrastar">
                        <GripIcon />
                      </span>
                      <button className={styles.treeToggle} onClick={() => !isEditing('folder', folder.id) && toggleFolder(folder.id)}>
                        <Chevron open={isOpen} />
                        {isArchived ? <Archive /> : (isOpen ? <FolderOpenIcon /> : <FolderIcon />)}
                        {isEditing('folder', folder.id) ? (
                          <RenameInput kind="folder" id={folder.id} />
                        ) : (
                          <span className={styles.treeName}>{folder.name}</span>
                        )}
                      </button>
                      <div className={styles.rowActions}>
                        <ContextMenu
                          trigger={
                            <button className={styles.iconBtn} aria-label="Ações da pasta" title="Mais">
                              <Dots />
                            </button>
                          }
                          items={[
                            { label: 'Renomear', onClick: () => startEditing('folder', folder.id, folder.name) },
                            { label: 'Duplicar', icon: <Copy />, onClick: async () => {
                              const { error } = await duplicateFolder(folder.id)
                              if (error) alert(error.message)
                            } },
                            { label: 'Importar...', icon: <ImportIcon />, onClick: () => openImport({ type: 'folder', folderId: folder.id }) },
                            { label: 'Permissões', icon: <Lock />, onClick: () => setPermissionsFolder(folder) },
                            { separator: true },
                            isArchived
                              ? { label: 'Desarquivar', icon: <Unarchive />, onClick: () => unarchiveFolder(folder.id) }
                              : { label: 'Arquivar', icon: <Archive />, onClick: () => archiveFolder(folder.id) },
                            { label: 'Excluir', icon: <Trash />, danger: true, onClick: () => softDeleteFolder(folder.id) },
                          ]}
                        />
                        <button
                          className={styles.iconBtn}
                          onClick={() => openModal('list', { folderId: folder.id })}
                          aria-label="Nova lista na pasta"
                          title="Nova lista"
                        >
                          <Plus />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <Droppable droppableId={`folder-${folder.id}-lists`} type="list">
                      {(__provL) => (
                      <div ref={__provL.innerRef} {...__provL.droppableProps} className={styles.nested}>
                        {folderLists.map((list, __lIdx) => {
                          const listArchived = !!list.archived_at
                          return (
                            <Draggable key={list.id} draggableId={`list-${list.id}`} index={__lIdx}>
                            {(__dpL, __snapL) => (
                            <div
                              ref={__dpL.innerRef}
                              {...__dpL.draggableProps}
                              className={`${styles.listRow} ${listArchived ? styles.archivedItem : ''} ${__snapL.isDragging ? styles.dragging : ''}`}
                            >
                              <span className={styles.dragHandle} {...__dpL.dragHandleProps} aria-label="Arrastar lista" title="Arrastar">
                                <GripIcon />
                              </span>
                              <button
                                className={`${styles.listBtn} ${activeList?.id === list.id ? styles.listActive : ''}`}
                                onClick={() => !isEditing('list', list.id) && selectList(list)}
                              >
                                {listArchived ? <Archive /> : <ListIcon />}
                                {isEditing('list', list.id) ? (
                                  <RenameInput kind="list" id={list.id} />
                                ) : (
                                  <span className={styles.treeName}>{list.name}</span>
                                )}
                              </button>
                              <ContextMenu
                                trigger={
                                  <button className={styles.iconBtn} aria-label="Ações da lista" title="Mais">
                                    <Dots />
                                  </button>
                                }
                                items={[
                                  { label: 'Renomear', onClick: () => startEditing('list', list.id, list.name) },
                                  { label: 'Duplicar', icon: <Copy />, onClick: async () => {
                                    const { error } = await duplicateList(list.id)
                                    if (error) alert(error.message)
                                  } },
                                  { label: 'Importar...', icon: <ImportIcon />, onClick: () => openImport({ type: 'list', listId: list.id }) },
                                  { label: 'Aplicar status do espaço', icon: <RefreshIcon />, onClick: () => handleApplySpaceStatuses(list.id, list.name) },
                                  { separator: true },
                                  listArchived
                                    ? { label: 'Desarquivar', icon: <Unarchive />, onClick: () => unarchiveList(list.id) }
                                    : { label: 'Arquivar', icon: <Archive />, onClick: () => archiveList(list.id) },
                                  { label: 'Excluir', icon: <Trash />, danger: true, onClick: () => softDeleteList(list.id) },
                                ]}
                              />
                            </div>
                            )}
                            </Draggable>
                          )
                        })}
                        {__provL.placeholder}
                        {folderLists.length === 0 && (
                          <p className={styles.hint}>Nenhuma lista</p>
                        )}
                      </div>
                      )}
                      </Droppable>
                    )}
                  </div>
                  )}
                  </Draggable>
                )
              })}
              {__provFolders.placeholder}
              </div>
              )}
              </Droppable>

              {/* Listas diretas (sem pasta) */}
              <Droppable droppableId="root-lists" type="list">
              {(__provR) => (
              <div ref={__provR.innerRef} {...__provR.droppableProps}>
              {rootLists.map((list, __rIdx) => {
                const listArchived = !!list.archived_at
                return (
                  <Draggable key={list.id} draggableId={`list-${list.id}`} index={__rIdx}>
                  {(__dpR, __snapR) => (
                  <div
                    ref={__dpR.innerRef}
                    {...__dpR.draggableProps}
                    {...__dpR.dragHandleProps}
                    className={`${styles.listRow} ${listArchived ? styles.archivedItem : ''} ${__snapR.isDragging ? styles.dragging : ''}`}
                  >
                    <button
                      className={`${styles.listBtn} ${activeList?.id === list.id ? styles.listActive : ''}`}
                      onClick={() => !isEditing('list', list.id) && selectList(list)}
                    >
                      {listArchived ? <Archive /> : <ListIcon />}
                      {isEditing('list', list.id) ? (
                        <RenameInput kind="list" id={list.id} />
                      ) : (
                        <span className={styles.treeName}>{list.name}</span>
                      )}
                    </button>
                    <ContextMenu
                      trigger={
                        <button className={styles.iconBtn} aria-label="Ações da lista" title="Mais">
                          <Dots />
                        </button>
                      }
                      items={[
                        { label: 'Renomear', onClick: () => startEditing('list', list.id, list.name) },
                        { label: 'Duplicar', icon: <Copy />, onClick: async () => {
                          const { error } = await duplicateList(list.id)
                          if (error) alert(error.message)
                        } },
                        { separator: true },
                        listArchived
                          ? { label: 'Desarquivar', icon: <Unarchive />, onClick: () => unarchiveList(list.id) }
                          : { label: 'Arquivar', icon: <Archive />, onClick: () => archiveList(list.id) },
                        { label: 'Excluir', icon: <Trash />, danger: true, onClick: () => softDeleteList(list.id) },
                      ]}
                    />
                  </div>
                  )}
                  </Draggable>
                )
              })}
              {__provR.placeholder}
              </div>
              )}
              </Droppable>

              {visibleFolders.length === 0 && rootLists.length === 0 && (
                <p className={styles.hint}>
                  {showArchived ? 'Nada arquivado e nenhuma pasta/lista ativa.' : 'Nenhuma pasta ou lista ainda'}
                </p>
              )}
            </nav>
            </DragDropContext>
          </>
        ) : (
          <div className={styles.noSpace}>
            <p>Selecione ou crie um espaço para começar</p>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer} ref={userMenuRef}>
          <div className={styles.userRow}>
            <button className={styles.userTrigger} onClick={() => setUserMenu(v => !v)}>
              <div className={styles.avatar}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" />
                  : getInitials(profile?.name)}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{profile?.name ?? 'Usuário'}</span>
                <span className={styles.userEmail}>{profile?.email}</span>
              </div>
            </button>
          </div>

          {userMenu && (
            <div className={styles.userMenu}>
              <button className={styles.menuItem} onClick={() => { setUserMenu(false); setShowProfile(true) }}>
                Editar perfil
              </button>
              {activeSpace && (
                <button className={styles.menuItem} onClick={() => { setUserMenu(false); setShowSpaceSettings(true) }}>
                  Configurações do espaço
                </button>
              )}
              <div className={styles.menuSeparator} />
              <div className={styles.menuLabel}>Tema</div>
              <div className={styles.themeRow}>
                {[
                  { id: 'light', label: 'Claro' },
                  { id: 'dark', label: 'Escuro' },
                  { id: 'system', label: 'Sistema' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`${styles.themeChip} ${themePref === t.id ? styles.themeChipActive : ''}`}
                    onClick={() => setTheme(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className={styles.menuSeparator} />
              <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={signOut}>
                Sair
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`${styles.versionChip} ${hasNewRelease ? styles.versionChipNew : ''}`}
          onClick={openReleases}
          title={hasNewRelease ? 'Há novidades nesta versão' : 'Ver notas de versão'}
        >
          <span className={styles.versionLabel}>v{CURRENT_VERSION}</span>
          {hasNewRelease && <span className={styles.versionDot} aria-hidden="true" />}
        </button>
      </aside>

      {showReleases && <ReleaseNotesModal onClose={() => setShowReleases(false)} />}
      {showImport && activeSpace && (
        <ImportModal space={activeSpace} initialTarget={importTarget} onClose={closeImport} />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSpaceSettings && activeSpace && (
        <SpaceSettingsModal space={activeSpace} onClose={() => setShowSpaceSettings(false)} />
      )}
      {permissionsFolder && (
        <FolderPermissionsPanel
          folder={permissionsFolder}
          onClose={() => setPermissionsFolder(null)}
        />
      )}

      {/* Modal */}
      {modal && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal} role="dialog">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modal === 'space' && 'Novo espaço'}
                {modal === 'folder' && 'Nova pasta'}
                {modal === 'list' && 'Nova lista'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModal(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Nome</label>
                <input
                  type="text" autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder={
                    modal === 'space' ? 'Ex: Compass Engenharia' :
                    modal === 'folder' ? 'Ex: Nexiall Consultoria' :
                    'Ex: UFV Barrinhas'
                  }
                />
              </div>

              {modal === 'space' && (
                <div className={styles.field}>
                  <label>Cor</label>
                  <div className={styles.colorRow}>
                    {COLORS.map(c => (
                      <button key={c} type="button"
                        className={`${styles.colorDot} ${form.color === c ? styles.colorSelected : ''}`}
                        style={{ background: c }}
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {modal === 'list' && (
                <div className={styles.field}>
                  <label>Status iniciais</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radio}>
                      <input type="radio" checked={form.useSpaceStatuses}
                        onChange={() => setForm(f => ({ ...f, useSpaceStatuses: true }))} />
                      Copiar do espaço
                    </label>
                    <label className={styles.radio}>
                      <input type="radio" checked={!form.useSpaceStatuses}
                        onChange={() => setForm(f => ({ ...f, useSpaceStatuses: false }))} />
                      Criar do zero
                    </label>
                  </div>
                </div>
              )}

              {createError && (
                <p style={{
                  fontSize: 12,
                  color: 'var(--color-danger)',
                  background: 'var(--color-danger-light)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 4,
                }}>
                  {createError}
                </p>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleCreate} disabled={saving || !form.name.trim()}>
                {saving ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
