import { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import modalStyles from './Modal.module.css'
import styles from './ProfileModal.module.css'

export default function ProfileModal({ onClose }) {
  const { profile, updateProfile, uploadAvatar } = useAuth()
  const { preference: themePref, setTheme } = useTheme()
  const fileInputRef = useRef(null)

  const [name, setName] = useState(profile?.name ?? '')
  const [prefs, setPrefs] = useState(profile?.notification_prefs ?? {})
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function getInitials(n) {
    return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    const { error } = await uploadAvatar(file)
    setUploading(false)
    if (error) setError(error.message ?? 'Falha ao enviar avatar')
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    const { error } = await updateProfile({
      name: name.trim() || profile.name,
      notification_prefs: prefs,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onClose()
  }

  function toggleNotification(key) {
    setPrefs(p => ({ ...p, [key]: !(p?.[key] ?? defaultsFor(key)) }))
  }

  function defaultsFor(key) {
    // default: in-app on, e-mail off (e-mail é fase posterior)
    if (key.startsWith('email_')) return false
    return true
  }

  function isOn(key) {
    return prefs?.[key] ?? defaultsFor(key)
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal}`} role="dialog">
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>Perfil</h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.avatarRow}>
            <div className={styles.avatarLarge}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" />
                : getInitials(profile?.name)}
            </div>
            <div className={styles.avatarActions}>
              <button
                type="button"
                className={modalStyles.btnSecondary}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Enviando...' : (profile?.avatar_url ? 'Trocar foto' : 'Enviar foto')}
              </button>
              {profile?.avatar_url && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={async () => {
                    setUploading(true)
                    await updateProfile({ avatar_url: null })
                    setUploading(false)
                  }}
                  disabled={uploading}
                >
                  Remover
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          <div className={modalStyles.field}>
            <label>Nome</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className={modalStyles.field}>
            <label>E-mail</label>
            <input type="email" value={profile?.email ?? ''} disabled />
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Tema</h3>
            <div className={styles.themeRow}>
              {[
                { id: 'light', label: 'Claro' },
                { id: 'dark', label: 'Escuro' },
                { id: 'system', label: 'Sistema' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.themeChip} ${themePref === t.id ? styles.themeChipActive : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Notificações no app</h3>
            {[
              { key: 'assigned', label: 'Quando me atribuírem uma tarefa' },
              { key: 'commented', label: 'Quando comentarem em algo meu' },
              { key: 'due_soon', label: 'Quando uma tarefa minha estiver perto do prazo' },
              { key: 'status_change', label: 'Quando o status de uma tarefa mudar' },
            ].map(opt => (
              <label key={opt.key} className={styles.prefRow}>
                <input
                  type="checkbox"
                  checked={isOn(opt.key)}
                  onChange={() => toggleNotification(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Notificações por e-mail</h3>
            <p className={styles.note}>
              Envio por e-mail será habilitado em fase futura. As preferências abaixo já ficam salvas.
            </p>
            {[
              { key: 'email_assigned', label: 'E-mail quando me atribuírem' },
              { key: 'email_due_soon', label: 'E-mail quando faltarem 24h para o prazo' },
              { key: 'email_weekly', label: 'Resumo semanal por e-mail' },
            ].map(opt => (
              <label key={opt.key} className={styles.prefRow}>
                <input
                  type="checkbox"
                  checked={isOn(opt.key)}
                  onChange={() => toggleNotification(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {error && <p className={modalStyles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button className={modalStyles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={modalStyles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
