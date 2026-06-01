import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../hooks/useApp'
import { useTheme } from '../../hooks/useTheme'
import ProfileModal from './ProfileModal'
import ContextMenu from './ContextMenu'
import ReleaseNotesModal from './ReleaseNotesModal'
import SpaceSettingsModal from '../space/SpaceSettingsModal'
import FolderPermissionsPanel from '../folder/FolderPermissionsPanel'
import { CURRENT_VERSION } from '../../data/releases'
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
  } = useApp()

  const [spaceDropdown, setSpaceDropdown] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSpaceSettings, setShowSpaceSettings] = useState(false)
  const [permissionsFolder, setPermissionsFolder] = useState(null)
  const [showReleases, setShowReleases] = useState(false)
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
            <nav className={styles.tree}>
              {/* Pastas */}
              {visibleFolders.map(folder => {
                const folderLists = visibleLists.filter(l => l.folder_id === folder.id)
                const isOpen = expandedFolders[folder.id]
                const isArchived = !!folder.archived_at
                return (
                  <div key={folder.id} className={isArchived ? styles.archivedItem : ''}>
                    <div className={styles.treeRow}>
                      <button className={styles.treeToggle} onClick={() => !isEditing('folder', folder.id) && toggleFolder(folder.id)}>
                        <Chevron open={isOpen} />
                        {isArchived ? <Archive /> : <FolderIcon />}
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
                      <div className={styles.nested}>
                        {folderLists.map(list => {
                          const listArchived = !!list.archived_at
                          return (
                            <div key={list.id} className={`${styles.listRow} ${listArchived ? styles.archivedItem : ''}`}>
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
                          )
                        })}
                        {folderLists.length === 0 && (
                          <p className={styles.hint}>Nenhuma lista</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Listas diretas (sem pasta) */}
              {rootLists.map(list => {
                const listArchived = !!list.archived_at
                return (
                  <div key={list.id} className={`${styles.listRow} ${listArchived ? styles.archivedItem : ''}`}>
                    <button
                      className={`${styles.listBtn} ${activeList?.id === list.id ? styles.listActive : ''}`}
                      onClick={() => selectList(list)}
                    >
                      {listArchived ? <Archive /> : <ListIcon />}
                      <span className={styles.treeName}>{list.name}</span>
                    </button>
                    <ContextMenu
                      trigger={
                        <button className={styles.iconBtn} aria-label="Ações da lista" title="Mais">
                          <Dots />
                        </button>
                      }
                      items={[
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
                )
              })}

              {visibleFolders.length === 0 && rootLists.length === 0 && (
                <p className={styles.hint}>
                  {showArchived ? 'Nada arquivado e nenhuma pasta/lista ativa.' : 'Nenhuma pasta ou lista ainda'}
                </p>
              )}
            </nav>
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
