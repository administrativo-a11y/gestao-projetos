import { useEffect, useRef, useState, useMemo } from 'react'
import styles from './StatusTypePopover.module.css'

/**
 * Popover ancorado num elemento (ex.: bolinha do status) com 2 abas:
 *  - Status: lista os list_statuses; click muda status_id
 *  - Tipo: lista os space_task_types; click muda type_id
 *
 * Props:
 *  - anchorRect: DOMRect do elemento que abriu o popover
 *  - statuses: list_statuses[]
 *  - types: space_task_types[]
 *  - currentStatusId, currentTypeId
 *  - onPickStatus(id), onPickType(id)
 *  - onClose()
 */
export default function StatusTypePopover({
  anchorRect, statuses = [], types = [],
  currentStatusId, currentTypeId,
  onPickStatus, onPickType, onClose,
}) {
  const [tab, setTab] = useState('status')
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDocDown(e) {
      if (!ref.current) return
      if (ref.current.contains(e.target)) return
      onClose?.()
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Posicionamento: tenta abrir abaixo do anchor; se não couber, abre acima.
  const style = useMemo(() => {
    if (!anchorRect) return { left: 0, top: 0 }
    const popW = 280
    const popH = 420
    let left = anchorRect.left
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12
    if (left < 12) left = 12
    let top = anchorRect.bottom + 6
    if (top + popH > window.innerHeight - 12) {
      top = Math.max(12, anchorRect.top - popH - 6)
    }
    return { left, top, width: popW }
  }, [anchorRect])

  const filteredStatuses = statuses.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase())
  )
  const filteredTypes = types.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      ref={ref}
      className={styles.popover}
      style={style}
      role="dialog"
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'status' ? styles.tabActive : ''}`}
          onClick={() => setTab('status')}
        >Status</button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'type' ? styles.tabActive : ''}`}
          onClick={() => setTab('type')}
        >Tipo de tarefa</button>
      </div>

      <div className={styles.searchWrap}>
        <input
          type="text"
          className={styles.search}
          placeholder="Pesquisar..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles.list}>
        {tab === 'status' ? (
          filteredStatuses.length === 0 ? (
            <div className={styles.empty}>Nenhum status</div>
          ) : (
            <>
              <div className={styles.sectionLabel}>Status</div>
              {filteredStatuses.map(s => {
                const selected = s.id === currentStatusId
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
                    onClick={() => { onPickStatus?.(s.id); onClose?.() }}
                  >
                    <span className={styles.statusDot} style={{ background: s.color }} />
                    <span className={styles.rowText}>{s.name}</span>
                    {selected && <span className={styles.check}>✓</span>}
                  </button>
                )
              })}
            </>
          )
        ) : (
          filteredTypes.length === 0 ? (
            <div className={styles.empty}>Nenhum tipo</div>
          ) : (
            <>
              <div className={styles.sectionLabel}>Tipos de tarefa</div>
              {filteredTypes.map(t => {
                const selected = t.id === currentTypeId
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
                    onClick={() => { onPickType?.(t.id); onClose?.() }}
                  >
                    <TypeIcon icon={t.icon} />
                    <span className={styles.rowText}>
                      {t.name}
                      {t.is_default && <span className={styles.defaultLabel}> (padrão)</span>}
                    </span>
                    {selected && <span className={styles.check}>✓</span>}
                  </button>
                )
              })}
            </>
          )
        )}
      </div>
    </div>
  )
}

function TypeIcon({ icon }) {
  // SVGs pequenos por chave; cores neutras (vão pegar currentColor)
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }
  switch (icon) {
    case 'milestone':
      return <svg {...common} className={styles.typeIcon}><polygon points="12 2 22 12 12 22 2 12 12 2"/></svg>
    case 'tracking':
      return <svg {...common} className={styles.typeIcon}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
    case 'critical':
      return <svg {...common} className={styles.typeIcon}><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>
    case 'meeting':
      return <svg {...common} className={styles.typeIcon}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    case 'task':
    default:
      return <svg {...common} className={styles.typeIcon}><circle cx="12" cy="12" r="9"/><polyline points="9 12 11 14 15 10"/></svg>
  }
}
