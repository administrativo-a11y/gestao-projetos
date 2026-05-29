import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSpaceMembers } from '../../hooks/useSpaceMembers'
import StatusesTab from './StatusesTab'
import modalStyles from '../shared/Modal.module.css'
import styles from './SpaceSettingsModal.module.css'

const ROLES = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'member', label: 'Membro' },
  { id: 'viewer', label: 'Visualizador' },
]

const ROLE_HINT = {
  owner: 'Acesso total — pode excluir o espaço',
  admin: 'Pode gerenciar membros, pastas e listas',
  member: 'Pode criar/editar tarefas',
  viewer: 'Somente leitura',
}

export default function SpaceSettingsModal({ space, onClose }) {
  const [tab, setTab] = useState('members')

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal} ${styles.modal}`} role="dialog">
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>
            <span style={{
              display: 'inline-block', width: 18, height: 18, borderRadius: 4,
              background: space.color, marginRight: 8, verticalAlign: 'middle',
            }} />
            {space.name}
          </h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          {[
            { id: 'members', label: 'Membros' },
            { id: 'statuses', label: 'Status' },
            { id: 'tags', label: 'Tags', disabled: true },
          ].map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''} ${t.disabled ? styles.tabDisabled : ''}`}
              onClick={() => !t.disabled && setTab(t.id)}
              disabled={t.disabled}
              title={t.disabled ? 'Em breve' : ''}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === 'members' && <MembersTab spaceId={space.id} />}
          {tab === 'statuses' && <StatusesTab spaceId={space.id} />}
        </div>
      </div>
    </div>
  )
}

function MembersTab({ spaceId }) {
  const { user } = useAuth()
  const {
    members, invitations, loading,
    updateRole, removeMember,
    createInvitation, revokeInvitation,
    inviteUrl, ownersCount,
  } = useSpaceMembers(spaceId)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [creating, setCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)
  const [error, setError] = useState('')

  const me = members.find(m => m.user_id === user?.id)
  const isAdmin = me && (me.role === 'owner' || me.role === 'admin')
  const owners = ownersCount()

  async function handleCreateInvite() {
    setError('')
    setCreating(true)
    const { error } = await createInvitation({ email: inviteEmail, role: inviteRole })
    setCreating(false)
    if (error) setError(error.message)
    else setInviteEmail('')
  }

  async function copyLink(token) {
    const url = inviteUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(t => t === token ? null : t), 2000)
    } catch {
      setError('Não foi possível copiar. Selecione o link manualmente: ' + url)
    }
  }

  async function handleChangeRole(member, newRole) {
    // Proteção: não rebaixar o último owner
    if (member.role === 'owner' && newRole !== 'owner' && owners <= 1) {
      setError('Não é possível rebaixar o único owner. Promova outro membro a owner primeiro.')
      return
    }
    setError('')
    const { error } = await updateRole(member.id, newRole)
    if (error) setError(error.message)
  }

  async function handleRemove(member) {
    if (member.role === 'owner' && owners <= 1) {
      setError('Não é possível remover o único owner.')
      return
    }
    if (!confirm(`Remover ${member.profiles?.name ?? 'membro'} do espaço?`)) return
    setError('')
    const { error } = await removeMember(member.id)
    if (error) setError(error.message)
  }

  function getInitials(n) {
    return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <>
      {isAdmin && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Convidar pessoas</h3>
          <div className={styles.inviteForm}>
            <input
              type="email"
              placeholder="email@exemplo.com (opcional)"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className={styles.input}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className={styles.select}
            >
              {ROLES.filter(r => r.id !== 'owner').map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <button
              className={modalStyles.btnPrimary}
              onClick={handleCreateInvite}
              disabled={creating}
            >
              {creating ? 'Gerando...' : 'Gerar link'}
            </button>
          </div>
          <p className={styles.note}>
            O e-mail é opcional. Gere o link e compartilhe — quem abrir e fizer login entra como o papel escolhido.
          </p>
        </section>
      )}

      {invitations.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Convites pendentes</h3>
          <ul className={styles.list}>
            {invitations.map(inv => (
              <li key={inv.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.email}>{inv.email ?? 'Link aberto'}</span>
                  <span className={styles.rolePill}>{ROLES.find(r => r.id === inv.role)?.label ?? inv.role}</span>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.linkBtn} onClick={() => copyLink(inv.token)}>
                    {copiedToken === inv.token ? 'Copiado!' : 'Copiar link'}
                  </button>
                  {isAdmin && (
                    <button className={styles.dangerBtn} onClick={() => revokeInvitation(inv.id)}>
                      Revogar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Membros ({members.length})</h3>
        <ul className={styles.list}>
          {members.map(m => {
            const isSelf = m.user_id === user?.id
            return (
              <li key={m.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.avatar}>
                    {m.profiles?.avatar_url
                      ? <img src={m.profiles.avatar_url} alt="" />
                      : getInitials(m.profiles?.name)}
                  </div>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>
                      {m.profiles?.name ?? '?'}
                      {isSelf && <span className={styles.youTag}> (você)</span>}
                    </span>
                    <span className={styles.memberEmail}>{m.profiles?.email}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  {isAdmin ? (
                    <select
                      className={styles.select}
                      value={m.role}
                      onChange={e => handleChangeRole(m, e.target.value)}
                      title={ROLE_HINT[m.role]}
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={styles.rolePill}>{ROLES.find(r => r.id === m.role)?.label ?? m.role}</span>
                  )}
                  {isAdmin && !isSelf && (
                    <button className={styles.dangerBtn} onClick={() => handleRemove(m)}>
                      Remover
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {error && <p className={modalStyles.error} style={{ marginTop: 12 }}>{error}</p>}
    </>
  )
}
