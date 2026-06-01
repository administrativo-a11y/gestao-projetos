import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNotifications } from '../../hooks/useNotifications'
import styles from './NotificationBell.module.css'

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

const CheckAllIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

function getInitials(n) {
  return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

function NotificationItem({ n, onClick }) {
  const isUnread = !n.read_at
  const actor = n.actor
  const time = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })

  return (
    <button
      type="button"
      className={`${styles.item} ${isUnread ? styles.itemUnread : ''}`}
      onClick={() => onClick(n)}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.avatar}>
        {actor?.avatar_url
          ? <img src={actor.avatar_url} alt="" />
          : getInitials(actor?.name)}
      </span>
      <div className={styles.body}>
        <div className={styles.title}>{n.title}</div>
        {n.body && <div className={styles.preview}>{n.body}</div>}
        <div className={styles.time}>{time}</div>
      </div>
    </button>
  )
}

export default function NotificationBell({ onOpenProfile }) {
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleClick(n) {
    setOpen(false)
    markAsRead(n.id)
    if (n.related_task_id && n.task?.list_id && n.task?.lists?.space_id) {
      navigate(`/space/${n.task.lists.space_id}/list/${n.task.list_id}?task=${n.related_task_id}`)
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${unreadCount > 0 ? styles.triggerActive : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Notificações"
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="dialog" aria-label="Notificações">
          <div className={styles.header}>
            <span className={styles.heading}>Notificações</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAll} onClick={markAllAsRead}>
                <CheckAllIcon /> Marcar todas
              </button>
            )}
          </div>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.empty}>Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>
                <span style={{ fontSize: 28, opacity: 0.4 }}>🔕</span>
                <p>Sem notificações por enquanto.</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem key={n.id} n={n} onClick={handleClick} />
              ))
            )}
          </div>

          {onOpenProfile && (
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.footerBtn}
                onClick={() => { setOpen(false); onOpenProfile() }}
              >
                Preferências de notificação
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
