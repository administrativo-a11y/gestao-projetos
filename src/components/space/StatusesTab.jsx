import { useState, useRef, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useSpaceStatuses } from '../../hooks/useSpaceStatuses'
import styles from './StatusesTab.module.css'

const COLOR_OPTIONS = [
  '#888780', '#378ADD', '#EF9F27', '#1D9E75',
  '#E24B4A', '#7F77DD', '#D4537E', '#639922',
  '#36C490', '#5BC0BE', '#3D5A80', '#8B5CF6',
]

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className={styles.colorWrap} ref={ref}>
      <button
        type="button"
        className={styles.colorDot}
        style={{ background: value }}
        onClick={() => setOpen(v => !v)}
        aria-label="Mudar cor"
      />
      {open && (
        <div className={styles.colorMenu}>
          {COLOR_OPTIONS.map(c => (
            <button
              key={c}
              type="button"
              className={`${styles.colorOpt} ${c === value ? styles.colorOptActive : ''}`}
              style={{ background: c }}
              onClick={() => { onChange(c); setOpen(false) }}
              aria-label={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusRow({ status, onUpdate, onDelete }) {
  const [name, setName] = useState(status.name)
  // Sincroniza quando outro usuário (realtime) edita
  useEffect(() => { setName(status.name) }, [status.name])

  return (
    <>
      <span className={styles.grip} aria-hidden="true">⋮⋮</span>
      <ColorPicker
        value={status.color}
        onChange={(c) => onUpdate({ color: c })}
      />
      <input
        type="text"
        className={styles.nameInput}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => name.trim() && name !== status.name && onUpdate({ name: name.trim() })}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={onDelete}
        aria-label="Excluir status"
        title="Excluir"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
        </svg>
      </button>
    </>
  )
}

export default function StatusesTab({ spaceId }) {
  const { statuses, loading, error, addStatus, updateStatus, removeStatus, reorder } = useSpaceStatuses(spaceId)

  async function onDragEnd(result) {
    if (!result.destination) return
    const ids = [...statuses].map(s => s.id)
    const [moved] = ids.splice(result.source.index, 1)
    ids.splice(result.destination.index, 0, moved)
    await reorder(ids)
  }

  async function handleDelete(s) {
    if (!confirm(`Excluir status "${s.name}"? Tarefas que estavam nele em listas existentes não são afetadas.`)) return
    await removeStatus(s.id)
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.note}>
        Estes status servem de <strong>template</strong>. Listas novas herdam o conjunto atual.
        Listas já existentes mantêm os status que copiaram quando foram criadas.
      </p>

      {loading ? (
        <div className={styles.empty}>Carregando...</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="space-statuses">
            {(provided) => (
              <div className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                {statuses.map((s, idx) => (
                  <Draggable key={s.id} draggableId={s.id} index={idx}>
                    {(dp, snap) => (
                      <div
                        ref={dp.innerRef}
                        {...dp.draggableProps}
                        {...dp.dragHandleProps}
                        className={`${styles.row} ${snap.isDragging ? styles.rowDragging : ''}`}
                      >
                        <StatusRow
                          status={s}
                          onUpdate={(patch) => updateStatus(s.id, patch)}
                          onDelete={() => handleDelete(s)}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <button className={styles.addBtn} onClick={() => addStatus({})}>
        + Adicionar status
      </button>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
