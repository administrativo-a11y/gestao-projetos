import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../hooks/useApp'
import { useTheme } from '../../hooks/useTheme'
import ProfileModal from './ProfileModal'
import SpaceSettingsModal from '../space/SpaceSettingsModal'
import FolderPermissionsPanel from '../folder/FolderPermissionsPanel'
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
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const { preference: themePref, setTheme } = useTheme()
  const {
    spaces, activeSpace, setActiveSpace,
    folders, lists, activeList, selectList,
    expandedFolders, toggleFolder,
    createSpace, softDeleteSpace,
    createFolder, softDeleteFolder,
    createList, softDeleteList,
  } = useApp()

  const [spaceDropdown, setSpaceDropdown] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSpaceSettings, setShowSpaceSettings] = useState(false)
  const [permissionsFolder, setPermissionsFolder] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', color: COLORS[0], useSpaceStatuses: true, folderId: null })
  const [saving, setSaving] = useState(false)
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
    setModal(type)
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    if (modal === 'space') await createSpace({ name: form.name, color: form.color })
    if (modal === 'folder') await createFolder({ name: form.name })
    if (modal === 'list') await createList({ name: form.name, folderId: form.folderId, useSpaceStatuses: form.useSpaceStatuses })
    setSaving(false)
    setModal(null)
  }

  function getInitials(name) {
    return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  // Listas sem pasta (direto no espaço)
  const rootLists = lists.filter(l => !l.folder_id)

  return (
    <>
      <aside className={styles.sidebar}>

        {/* Dropdown de espaço — canto superior esquerdo */}
        <div className={styles.spaceBar} ref={dropdownRef}>
          <button className={styles.spaceSelector} onClick={() => setSpaceDropdown(v => !v)}>
            {activeSpace ? (
              <>
                <span className={styles.spaceIcon} style={{ background: activeSpace.color }}>
                  {activeSpace.name[0].toUpperCase()}
                </span>
                <span className={styles.spaceName}>{activeSpace.name}</span>
              </>
            ) : (
              <>
                <span className={styles.spaceIconEmpty}>?</span>
                <span className={styles.spaceNameEmpty}>Selecionar espaço</span>
              </>
            )}
            <Chevron open={spaceDropdown} />
          </button>

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
                  <button className={styles.deleteBtn} onClick={() => softDeleteSpace(sp.id)} aria-label="Excluir espaço">
                    <Trash />
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
            <div className={styles.treeActions}>
              <button className={styles.actionBtn} onClick={() => openModal('folder')}>
                <FolderIcon /> Nova pasta
              </button>
              <button className={styles.actionBtn} onClick={() => openModal('list', { folderId: null })}>
                <ListIcon /> Nova lista
              </button>
            </div>

            <nav className={styles.tree}>
              {/* Pastas */}
              {folders.map(folder => {
                const folderLists = lists.filter(l => l.folder_id === folder.id)
                const isOpen = expandedFolders[folder.id]
                return (
                  <div key={folder.id}>
                    <div className={styles.treeRow}>
                      <button className={styles.treeToggle} onClick={() => toggleFolder(folder.id)}>
                        <Chevron open={isOpen} />
                        <FolderIcon />
                        <span className={styles.treeName}>{folder.name}</span>
                      </button>
                      <div className={styles.rowActions}>
                        <button className={styles.iconBtn} onClick={() => setPermissionsFolder(folder)} aria-label="Permissões da pasta" title="Permissões">
                          <Lock />
                        </button>
                        <button className={styles.iconBtn} onClick={() => openModal('list', { folderId: folder.id })} aria-label="Nova lista na pasta">
                          <Plus />
                        </button>
                        <button className={styles.deleteBtn} onClick={() => softDeleteFolder(folder.id)} aria-label="Excluir pasta">
                          <Trash />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className={styles.nested}>
                        {folderLists.map(list => (
                          <div key={list.id} className={styles.listRow}>
                            <button
                              className={`${styles.listBtn} ${activeList?.id === list.id ? styles.listActive : ''}`}
                              onClick={() => selectList(list)}
                            >
                              <ListIcon />
                              <span className={styles.treeName}>{list.name}</span>
                            </button>
                            <button className={styles.deleteBtn} onClick={() => softDeleteList(list.id)} aria-label="Excluir lista">
                              <Trash />
                            </button>
                          </div>
                        ))}
                        {folderLists.length === 0 && (
                          <p className={styles.hint}>Nenhuma lista</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Listas diretas (sem pasta) */}
              {rootLists.map(list => (
                <div key={list.id} className={styles.listRow}>
                  <button
                    className={`${styles.listBtn} ${activeList?.id === list.id ? styles.listActive : ''}`}
                    onClick={() => selectList(list)}
                  >
                    <ListIcon />
                    <span className={styles.treeName}>{list.name}</span>
                  </button>
                  <button className={styles.deleteBtn} onClick={() => softDeleteList(list.id)} aria-label="Excluir lista">
                    <Trash />
                  </button>
                </div>
              ))}

              {folders.length === 0 && rootLists.length === 0 && (
                <p className={styles.hint}>Nenhuma pasta ou lista ainda</p>
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
      </aside>

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
