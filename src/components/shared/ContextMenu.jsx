import { useState, useRef, useEffect, cloneElement } from 'react'
import styles from './ContextMenu.module.css'

/**
 * ContextMenu — dropdown reutilizável.
 *
 * @param {ReactElement} trigger  elemento clicável que abre o menu (ex: <button>⋯</button>)
 * @param {Array} items  itens do menu. Cada item:
 *   - { label, onClick, icon?, danger?: bool, separator?: bool }
 *   - { separator: true } para divisor
 * @param {'left'|'right'} align  alinhamento do menu (default 'right')
 */
export default function ContextMenu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visibleItems = (items ?? []).filter(Boolean)

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {cloneElement(trigger, {
        onClick: (e) => {
          e.stopPropagation()
          setOpen(v => !v)
          if (trigger.props.onClick) trigger.props.onClick(e)
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open && (
        <div className={`${styles.menu} ${align === 'left' ? styles.alignLeft : styles.alignRight}`} role="menu">
          {visibleItems.map((it, i) => {
            if (it.separator) return <div key={`s${i}`} className={styles.separator} />
            return (
              <button
                key={it.label + i}
                type="button"
                role="menuitem"
                className={`${styles.item} ${it.danger ? styles.itemDanger : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  it.onClick?.(e)
                }}
                disabled={it.disabled}
              >
                {it.icon && <span className={styles.itemIcon}>{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
