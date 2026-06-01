import { useState, useRef, useEffect, useMemo } from 'react'
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
  const {
    statuses, loading, error,
    addStatus, updateStatus, removeStatus, reorder,
    resetToDefaults, cleanupNovoStatus,
  } = useSpaceStatuses(spaceId)
  const [adding, setAdding] = useState(false)

  // Agrupa por categoria mantendo a ordem
  const grouped = useMemo(() => ({
    open: statuses.filter(s => (s.category ?? 'open') === 'open'),
    closed: statuses.filter(s => (s.category ?? 'open') === 'closed'),
  }), [statuses])

  async function onDragEnd(result) {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Se mudou de grupo: troca a category primeiro
    if (source.droppableId !== destination.droppableId) {
      await updateStatus(draggableId, { category: destination.droppableId })
    }

    // Refaz a ordem usando o estado pós-update
    const next = {
      open: [...grouped.open],
      closed: [...grouped.closed],
    }
    if (source.droppableId !== destination.droppableId) {
      // remove do source
      const movedIdx = next[source.droppableId].findIndex(s => s.id === draggableId)
      if (movedIdx !== -1) next[source.droppableId].splice(movedIdx, 1)
      // insere no destination (com category nova representada virtualmente)
      const moved = statuses.find(s => s.id === draggableId)
      if (moved) next[destination.droppableId].splice(destination.index, 0, { ...moved, category: destination.droppableId })
    } else {
      const [moved] = next[source.droppableId].splice(source.index, 1)
      next[source.droppableId].splice(destination.index, 0, moved)
    }

    const orderedIds = [...next.open, ...next.closed].map(s => s.id)
    await reorder(orderedIds)
  }

  async function handleDelete(s) {
    if (!confirm(`Excluir status "${s.name}"? Listas existentes que já copiaram este status não são afetadas.`)) return
    await removeStatus(s.id)
  }

  async function handleAdd(category) {
    if (adding) return
    setAdding(true)
    try { await addStatus({ category }) } finally { setAdding(false) }
  }

  async function handleReset() {
    if (!confirm('Resetar os status pros padrões? Apaga os status atuais e recria o conjunto padrão (TO START, EM PROGRESSO, PENDING, ON HOLD, REVIEW, CANCELED, DONE, ARCHIVE). Listas existentes mantêm o que copiaram.')) return
    await resetToDefaults()
  }

  async function handleCleanup() {
    const { deleted } = await cleanupNovoStatus()
    alert(`${deleted} status "Novo status" removidos.`)
  }

  const hasDuplicateNovoStatus = statuses.filter(s =>
    s.name?.trim().toLowerCase() === 'novo status'
  ).length > 1

  return (
    <div className={styles.wrap}>
      <p className={styles.note}>
        Estes status servem de <strong>template</strong>. Listas novas herdam o conjunto atual.
        Listas já existentes mantêm os status que copiaram quando foram criadas.
        Status em <strong>Fechado</strong> ocultam as tarefas das visualizações por padrão.
      </p>

      {hasDuplicateNovoStatus && (
        <div className={styles.warningBox}>
          <span>Detectados vários status com nome "Novo status".</span>
          <button type="button" className={styles.warningBtn} onClick={handleCleanup}>
            Limpar duplicatas
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>Carregando...</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Grupo: Status (open) */}
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>Status</span>
            <span className={styles.groupCount}>{grouped.open.length}</span>
          </div>
          <Droppable droppableId="open">
            {(provided) => (
              <div className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                {grouped.open.length === 0 && (
                  <div className={styles.emptyGroup}>Arraste status aqui ou clique em "Adicionar"</div>
                )}
                {grouped.open.map((s, idx) => (
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
          <button
            className={styles.addBtn}
            onClick={() => handleAdd('open')}
            disabled={adding}
          >
            + Adicionar status
          </button>

          {/* Grupo: Fechado (closed) */}
          <div className={styles.groupHeader} style={{ marginTop: 24 }}>
            <span className={styles.groupTitle}>Fechado</span>
            <span className={styles.groupCount}>{grouped.closed.length}</span>
            <span className={styles.groupHint}>(arquivado — ocultos por padrão)</span>
          </div>
          <Droppable droppableId="closed">
            {(provided) => (
              <div className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                {grouped.closed.length === 0 && (
                  <div className={styles.emptyGroup}>Arraste status aqui pra arquivá-los</div>
                )}
                {grouped.closed.map((s, idx) => (
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
          <button
            className={styles.addBtn}
            onClick={() => handleAdd('closed')}
            disabled={adding}
          >
            + Adicionar status fechado
          </button>
        </DragDropContext>
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.resetBtn} onClick={handleReset}>
          Resetar pros padrões
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
