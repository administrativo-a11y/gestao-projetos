import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from './CustomFieldInput'
import styles from './CustomField.module.css'

function getInitials(n) {
  return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

function UserDisplay({ userId }) {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data }) => { if (!cancelled) setProfile(data) })
    return () => { cancelled = true }
  }, [userId])

  if (!userId) return <span className={styles.empty}>—</span>
  return (
    <span className={styles.userBadge}>
      <span className={styles.userAvatar}>
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" />
          : getInitials(profile?.name)}
      </span>
      <span className={styles.userName}>{profile?.name ?? '...'}</span>
    </span>
  )
}

export default function CustomFieldDisplay({ field, value }) {
  const t = field.type
  const empty = value === null || value === undefined || value === ''

  if (empty && t !== 'checkbox') return <span className={styles.empty}>—</span>

  if (t === 'text' || t === 'phone') {
    return <span>{String(value)}</span>
  }

  if (t === 'url') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
        onClick={e => e.stopPropagation()}
      >
        {value}
      </a>
    )
  }

  if (t === 'email') {
    return (
      <a
        href={`mailto:${value}`}
        className={styles.link}
        onClick={e => e.stopPropagation()}
      >
        {value}
      </a>
    )
  }

  if (t === 'number') {
    return <span>{Number(value).toLocaleString('pt-BR')}</span>
  }

  if (t === 'currency') {
    return <span>{formatCurrency(value, field.options?.currency ?? 'BRL')}</span>
  }

  if (t === 'date') {
    try {
      return <span>{format(new Date(value), "dd MMM yyyy", { locale: ptBR })}</span>
    } catch { return <span>{value}</span> }
  }

  if (t === 'checkbox') {
    return value
      ? <span className={styles.checkYes}>✓</span>
      : <span className={styles.empty}>—</span>
  }

  if (t === 'select') {
    const choice = (field.options?.choices ?? []).find(c => c.id === value)
    if (!choice) return <span className={styles.empty}>—</span>
    return (
      <span className={styles.pill} style={{ background: (choice.color ?? '#888') + '22', color: choice.color }}>
        {choice.label}
      </span>
    )
  }

  if (t === 'multi_select') {
    const choices = field.options?.choices ?? []
    const ids = Array.isArray(value) ? value : []
    const matched = choices.filter(c => ids.includes(c.id))
    if (matched.length === 0) return <span className={styles.empty}>—</span>
    return (
      <span className={styles.pills}>
        {matched.map(c => (
          <span key={c.id} className={styles.pill} style={{ background: (c.color ?? '#888') + '22', color: c.color }}>
            {c.label}
          </span>
        ))}
      </span>
    )
  }

  if (t === 'user') {
    return <UserDisplay userId={value} />
  }

  return <span>{String(value)}</span>
}
