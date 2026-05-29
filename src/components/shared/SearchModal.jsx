import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import styles from './SearchModal.module.css'

const TaskIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)
const SpaceIcon = ({ color }) => (
  <span style={{ width: 14, height: 14, borderRadius: 4, background: color || 'var(--color-accent)', display: 'inline-block' }} />
)

export default function SearchModal({ onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { results, loading, total } = useGlobalSearch(query)
  const inputRef = useRef(null)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Lista linear de items pra navegar com setas
  const flat = [
    ...results.tasks.map(t => ({ kind: 'task', item: t })),
    ...results.lists.map(l => ({ kind: 'list', item: l })),
    ...results.folders.map(f => ({ kind: 'folder', item: f })),
    ...results.spaces.map(s => ({ kind: 'space', item: s })),
  ]

  useEffect(() => { setHighlight(0) }, [query])

  function go(kind, item) {
    if (kind === 'task') {
      navigate(`/space/${item.lists?.space_id}/list/${item.list_id}`)
    } else if (kind === 'list') {
      navigate(`/space/${item.space_id}/list/${item.id}`)
    } else if (kind === 'folder') {
      navigate(`/space/${item.space_id}`)
    } else if (kind === 'space') {
      navigate(`/space/${item.id}`)
    }
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, Math.max(0, flat.length - 1))); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const sel = flat[highlight]
      if (sel) go(sel.kind, sel.item)
      return
    }
  }

  function Group({ title, items, kind, baseIndex, render }) {
    if (items.length === 0) return null
    return (
      <div className={styles.group}>
        <div className={styles.groupTitle}>{title}</div>
        {items.map((it, idx) => {
          const flatIdx = baseIndex + idx
          return (
            <button
              key={it.id}
              type="button"
              className={`${styles.item} ${flatIdx === highlight ? styles.itemActive : ''}`}
              onClick={() => go(kind, it)}
              onMouseEnter={() => setHighlight(flatIdx)}
            >
              {render(it)}
            </button>
          )
        })}
      </div>
    )
  }

  let cursor = 0
  const tBase = cursor; cursor += results.tasks.length
  const lBase = cursor; cursor += results.lists.length
  const fBase = cursor; cursor += results.folders.length
  const sBase = cursor

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label="Busca">
        <div className={styles.inputWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar tarefas, listas, pastas, espaços..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className={styles.input}
          />
          <kbd className={styles.kbd}>ESC</kbd>
        </div>

        <div className={styles.results}>
          {query.trim().length < 2 ? (
            <div className={styles.hint}>Digite pelo menos 2 caracteres para buscar.</div>
          ) : loading ? (
            <div className={styles.hint}>Buscando...</div>
          ) : total === 0 ? (
            <div className={styles.hint}>Nenhum resultado para "{query}".</div>
          ) : (
            <>
              <Group
                title="Tarefas" kind="task" baseIndex={tBase} items={results.tasks}
                render={t => (
                  <>
                    <span className={styles.icon}><TaskIcon /></span>
                    <span className={styles.label}>{t.title}</span>
                    <span className={styles.crumbs}>
                      {t.lists?.spaces?.name} / {t.lists?.name}
                    </span>
                  </>
                )}
              />
              <Group
                title="Listas" kind="list" baseIndex={lBase} items={results.lists}
                render={l => (
                  <>
                    <span className={styles.icon}><ListIcon /></span>
                    <span className={styles.label}>{l.name}</span>
                    <span className={styles.crumbs}>
                      {l.spaces?.name}{l.folders ? ' / ' + l.folders.name : ''}
                    </span>
                  </>
                )}
              />
              <Group
                title="Pastas" kind="folder" baseIndex={fBase} items={results.folders}
                render={f => (
                  <>
                    <span className={styles.icon}><FolderIcon /></span>
                    <span className={styles.label}>{f.name}</span>
                    <span className={styles.crumbs}>{f.spaces?.name}</span>
                  </>
                )}
              />
              <Group
                title="Espaços" kind="space" baseIndex={sBase} items={results.spaces}
                render={s => (
                  <>
                    <span className={styles.icon}><SpaceIcon color={s.color} /></span>
                    <span className={styles.label}>{s.name}</span>
                  </>
                )}
              />
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span><kbd className={styles.kbdMini}>↑</kbd><kbd className={styles.kbdMini}>↓</kbd> navegar</span>
          <span><kbd className={styles.kbdMini}>↵</kbd> abrir</span>
          <span><kbd className={styles.kbdMini}>ESC</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
