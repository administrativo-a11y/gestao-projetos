import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpaceMembers } from '../../hooks/useSpaceMembers'
import modalStyles from '../shared/Modal.module.css'
import styles from './FolderPermissionsPanel.module.css'

const PERMISSIONS = [
  { id: 'inherit', label: 'Herdar do espaço' },
  { id: 'view', label: 'Visualizar' },
  { id: 'edit', label: 'Editar' },
  { id: 'admin', label: 'Admin' },
]

export default function FolderPermissionsPanel({ folder, onClose }) {
  const { members, loading: membersLoading } = useSpaceMembers(folder.space_id)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refetch() {
    setLoading(true)
    const { data } = await supabase
      .from('folder_permissions')
      .select('*')
      .eq('folder_id', folder.id)
    setRules(data ?? [])
    setLoading(false)
  }

  useEffect(() => { refetch() }, [folder.id])

  function currentFor(memberUserId) {
    const r = rules.find(x => x.user_id === memberUserId)
    return r?.permission ?? 'inherit'
  }

  async function setForUser(memberUserId, newValue) {
    setError('')
    const existing = rules.find(x => x.user_id === memberUserId)
    if (newValue === 'inherit') {
      if (existing) {
        const { error } = await supabase.from('folder_permissions').delete().eq('id', existing.id)
        if (error) { setError(error.message); return }
      }
    } else if (existing) {
      const { error } = await supabase
        .from('folder_permissions')
        .update({ permission: newValue })
        .eq('id', existing.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase
        .from('folder_permissions')
        .insert({ folder_id: folder.id, user_id: memberUserId, permission: newValue })
      if (error) { setError(error.message); return }
    }
    await refetch()
  }

  function getInitials(n) {
    return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal}`} role="dialog">
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>Permissões — {folder.name}</h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.note}>
            "Herdar" usa o papel do membro no espaço (admin/member = editar, viewer = visualizar).
            Owners e admins do espaço têm acesso total automaticamente.
          </p>

          {(loading || membersLoading) ? (
            <div className={styles.loading}>Carregando...</div>
          ) : (
            <ul className={styles.list}>
              {members.map(m => {
                const isSpaceAdmin = m.role === 'owner' || m.role === 'admin'
                return (
                  <li key={m.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.avatar}>
                        {m.profiles?.avatar_url
                          ? <img src={m.profiles.avatar_url} alt="" />
                          : getInitials(m.profiles?.name)}
                      </div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{m.profiles?.name}</span>
                        <span className={styles.memberRole}>{m.role}</span>
                      </div>
                    </div>
                    {isSpaceAdmin ? (
                      <span className={styles.locked}>Admin (acesso total)</span>
                    ) : (
                      <select
                        className={styles.select}
                        value={currentFor(m.user_id)}
                        onChange={e => setForUser(m.user_id, e.target.value)}
                      >
                        {PERMISSIONS.map(p => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {error && <p className={modalStyles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button className={modalStyles.btnSecondary} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
