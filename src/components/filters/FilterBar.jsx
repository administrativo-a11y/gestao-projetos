import { useState, useRef, useEffect } from 'react'
import { useTaskFilters } from '../../hooks/useTaskFilters'
import { useSpaceMembers } from '../../hooks/useSpaceMembers'
import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../hooks/useAuth'
import { useTasks } from '../../hooks/useTasks'
import styles from './FilterBar.module.css'

function Popover({ children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return <div className={styles.popover} ref={ref}>{children}</div>
}

function FilterPill({ active, label, count, onClick }) {
  return (
    <button className={`${styles.pill} ${active ? styles.pillActive : ''}`} onClick={onClick}>
      {label}
      {count > 0 && <span className={styles.pillCount}>{count}</span>}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

export default function FilterBar() {
  const { filters, setFilters, clearFilters, isActive } = useTaskFilters()
  const { activeSpace, activeList } = useApp()
  const { user } = useAuth()
  const { statuses } = useTasks(activeList?.id)
  const { members } = useSpaceMembers(activeSpace?.id)

  const [open, setOpen] = useState(null) // 'status' | 'priority' | 'assignee' | 'due' | null

  function toggleInArray(key, value) {
    const arr = filters[key] ?? []
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
    setFilters({ ...filters, [key]: next })
  }

  return (
    <div className={styles.bar}>
      <div className={styles.pillGroup}>
        <div className={styles.pillWrap}>
          <FilterPill
            label="Status"
            active={filters.status_ids?.length > 0}
            count={filters.status_ids?.length ?? 0}
            onClick={() => setOpen(open === 'status' ? null : 'status')}
          />
          {open === 'status' && (
            <Popover onClose={() => setOpen(null)}>
              {statuses.map(s => (
                <label key={s.id} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={(filters.status_ids ?? []).includes(s.id)}
                    onChange={() => toggleInArray('status_ids', s.id)}
                  />
                  <span className={styles.dot} style={{ background: s.color }} />
                  <span>{s.name}</span>
                </label>
              ))}
            </Popover>
          )}
        </div>

        <div className={styles.pillWrap}>
          <FilterPill
            label="Prioridade"
            active={filters.priorities?.length > 0}
            count={filters.priorities?.length ?? 0}
            onClick={() => setOpen(open === 'priority' ? null : 'priority')}
          />
          {open === 'priority' && (
            <Popover onClose={() => setOpen(null)}>
              {[
                { id: 'high', label: 'Alta', color: 'var(--color-priority-high)' },
                { id: 'medium', label: 'Média', color: 'var(--color-priority-medium)' },
                { id: 'low', label: 'Baixa', color: 'var(--color-priority-low)' },
              ].map(p => (
                <label key={p.id} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={(filters.priorities ?? []).includes(p.id)}
                    onChange={() => toggleInArray('priorities', p.id)}
                  />
                  <span className={styles.dot} style={{ background: p.color }} />
                  <span>{p.label}</span>
                </label>
              ))}
            </Popover>
          )}
        </div>

        <div className={styles.pillWrap}>
          <FilterPill
            label="Responsável"
            active={filters.assignee_ids?.length > 0}
            count={filters.assignee_ids?.length ?? 0}
            onClick={() => setOpen(open === 'assignee' ? null : 'assignee')}
          />
          {open === 'assignee' && (
            <Popover onClose={() => setOpen(null)}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={(filters.assignee_ids ?? []).includes('me')}
                  onChange={() => toggleInArray('assignee_ids', 'me')}
                />
                <span className={styles.dotPlaceholder}>★</span>
                <span>Atribuídas a mim</span>
              </label>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={(filters.assignee_ids ?? []).includes('none')}
                  onChange={() => toggleInArray('assignee_ids', 'none')}
                />
                <span className={styles.dotPlaceholder}>—</span>
                <span>Sem responsável</span>
              </label>
              <div className={styles.separator} />
              {members
                .filter(m => m.user_id !== user?.id)
                .map(m => (
                  <label key={m.user_id} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={(filters.assignee_ids ?? []).includes(m.user_id)}
                      onChange={() => toggleInArray('assignee_ids', m.user_id)}
                    />
                    <span className={styles.dotPlaceholder}>
                      {m.profiles?.name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span>{m.profiles?.name}</span>
                  </label>
                ))}
            </Popover>
          )}
        </div>

        <div className={styles.pillWrap}>
          <FilterPill
            label="Prazo"
            active={!!filters.due_from || !!filters.due_to || filters.only_overdue}
            count={[!!filters.due_from, !!filters.due_to, filters.only_overdue].filter(Boolean).length}
            onClick={() => setOpen(open === 'due' ? null : 'due')}
          />
          {open === 'due' && (
            <Popover onClose={() => setOpen(null)}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={!!filters.only_overdue}
                  onChange={() => setFilters({ ...filters, only_overdue: !filters.only_overdue })}
                />
                <span className={styles.dot} style={{ background: 'var(--color-priority-high)' }} />
                <span>Atrasadas</span>
              </label>
              <div className={styles.separator} />
              <div className={styles.dateRow}>
                <label>De</label>
                <input
                  type="date"
                  value={filters.due_from ?? ''}
                  onChange={e => setFilters({ ...filters, due_from: e.target.value || null })}
                />
              </div>
              <div className={styles.dateRow}>
                <label>Até</label>
                <input
                  type="date"
                  value={filters.due_to ?? ''}
                  onChange={e => setFilters({ ...filters, due_to: e.target.value || null })}
                />
              </div>
            </Popover>
          )}
        </div>
      </div>

      {isActive && (
        <button className={styles.clearBtn} onClick={clearFilters}>
          Limpar filtros
        </button>
      )}
    </div>
  )
}
