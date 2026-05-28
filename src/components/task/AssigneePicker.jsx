import { useState, useRef, useEffect } from 'react'
import { useSpaceMembers } from '../../hooks/useSpaceMembers'
import { useApp } from '../../hooks/useApp'
import styles from './AssigneePicker.module.css'

function getInitials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

function Avatar({ profile, size = 22 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (profile?.avatar_url) {
    return <span className={styles.avatar} style={style}><img src={profile.avatar_url} alt="" /></span>
  }
  return <span className={styles.avatar} style={style}>{getInitials(profile?.name)}</span>
}

export default function AssigneePicker({
  value,            // array of user_ids (multi) OR single user_id string (single)
  onChange,
  multi = true,
  size = 22,
  placeholder = 'Sem responsável',
}) {
  const { activeSpace } = useApp()
  const { members, loading } = useSpaceMembers(activeSpace?.id)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedIds = multi
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : [])

  const selected = members.filter(m => selectedIds.includes(m.user_id))

  function toggle(userId) {
    if (multi) {
      const next = selectedIds.includes(userId)
        ? selectedIds.filter(id => id !== userId)
        : [...selectedIds, userId]
      onChange(next)
    } else {
      onChange(selectedIds[0] === userId ? null : userId)
      setOpen(false)
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(v => !v)}>
        {selected.length === 0 ? (
          <span className={styles.placeholder}>{placeholder}</span>
        ) : (
          <span className={styles.selectedRow}>
            {selected.slice(0, 3).map(m => (
              <Avatar key={m.user_id} profile={m.profiles} size={size} />
            ))}
            {selected.length > 3 && (
              <span className={styles.more}>+{selected.length - 3}</span>
            )}
          </span>
        )}
        <svg className={styles.chevron} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.menu}>
          {loading && <div className={styles.empty}>Carregando...</div>}
          {!loading && members.length === 0 && (
            <div className={styles.empty}>Nenhum membro no espaço</div>
          )}
          {!multi && selectedIds.length > 0 && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => { onChange(null); setOpen(false) }}
            >
              <span className={styles.avatarPlaceholder}>—</span>
              <span>Remover responsável</span>
            </button>
          )}
          {members.map(m => {
            const isSel = selectedIds.includes(m.user_id)
            return (
              <button
                key={m.user_id}
                type="button"
                className={`${styles.menuItem} ${isSel ? styles.menuItemActive : ''}`}
                onClick={() => toggle(m.user_id)}
              >
                <Avatar profile={m.profiles} size={22} />
                <span className={styles.memberName}>{m.profiles?.name}</span>
                {isSel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className={styles.check}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
