import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useCustomFields, FIELD_TYPES } from '../../hooks/useCustomFields'
import styles from './CustomFieldsManager.module.css'

const CHOICE_COLORS = ['#888780', '#378ADD', '#EF9F27', '#1D9E75', '#E24B4A', '#7F77DD', '#D4537E', '#36C490']

function genChoiceId() {
  return 'c_' + Math.random().toString(36).slice(2, 9)
}

function ChoicesEditor({ choices, onChange }) {
  function update(i, patch) {
    const next = choices.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    onChange(next)
  }
  function add() {
    const idx = choices.length
    onChange([...choices, { id: genChoiceId(), label: `Opção ${idx + 1}`, color: CHOICE_COLORS[idx % CHOICE_COLORS.length] }])
  }
  function remove(i) {
    onChange(choices.filter((_, idx) => idx !== i))
  }

  return (
    <div className={styles.choicesWrap}>
      {choices.length === 0 && (
        <div className={styles.empty}>Nenhuma opção. Adicione uma.</div>
      )}
      {choices.map((c, i) => (
        <div key={c.id} className={styles.choiceRow}>
          <span className={styles.choiceDot} style={{ background: c.color }}>
            <input
              type="color"
              value={c.color}
              onChange={e => update(i, { color: e.target.value })}
              aria-label="Cor"
            />
          </span>
          <input
            type="text"
            value={c.label}
            onChange={e => update(i, { label: e.target.value })}
            className={styles.choiceInput}
          />
          <button type="button" className={styles.choiceDelete} onClick={() => remove(i)} aria-label="Excluir opção">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}
      <button type="button" className={styles.addChoice} onClick={add}>+ Adicionar opção</button>
    </div>
  )
}

function FieldRow({ field, onUpdate, onDelete, onOpenChoices, dragHandle }) {
  const [name, setName] = useState(field.name)
  useEffect(() => { setName(field.name) }, [field.name])

  const typeLabel = FIELD_TYPES.find(t => t.id === field.type)?.label ?? field.type
  const hasChoices = field.type === 'select' || field.type === 'multi_select'

  return (
    <>
      <span {...dragHandle} className={styles.grip} aria-hidden="true">⋮⋮</span>
      <input
        type="text"
        className={styles.nameInput}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => name.trim() && name !== field.name && onUpdate({ name: name.trim() })}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className={styles.typeBadge}>{typeLabel}</span>
      {hasChoices && (
        <button type="button" className={styles.linkBtn} onClick={onOpenChoices}>
          {field.options?.choices?.length ?? 0} opções
        </button>
      )}
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={onDelete}
        aria-label="Excluir campo"
        title="Excluir"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
        </svg>
      </button>
    </>
  )
}

function AddFieldForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('text')
  const needsChoices = type === 'select' || type === 'multi_select'

  function handle(e) {
    e.preventDefault()
    if (!name.trim()) return
    const options = needsChoices
      ? { choices: [
          { id: genChoiceId(), label: 'Aberto', color: CHOICE_COLORS[0] },
          { id: genChoiceId(), label: 'Em andamento', color: CHOICE_COLORS[1] },
          { id: genChoiceId(), label: 'Concluído', color: CHOICE_COLORS[3] },
        ] }
      : {}
    onAdd({ name: name.trim(), type, options })
  }

  return (
    <form className={styles.addForm} onSubmit={handle}>
      <input
        type="text"
        placeholder="Nome do campo"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
        className={styles.addInput}
      />
      <select className={styles.addSelect} value={type} onChange={e => setType(e.target.value)}>
        {FIELD_TYPES.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <button type="submit" className={styles.addConfirm}>Adicionar</button>
      <button type="button" className={styles.addCancel} onClick={onCancel}>Cancelar</button>
    </form>
  )
}

export default function CustomFieldsManager({ listId }) {
  const { fields, loading, error, addField, updateField, removeField, reorder } = useCustomFields(listId)
  const [adding, setAdding] = useState(false)
  const [choicesEditor, setChoicesEditor] = useState(null) // field id

  async function onDragEnd(result) {
    if (!result.destination) return
    const ids = fields.map(f => f.id)
    const [moved] = ids.splice(result.source.index, 1)
    ids.splice(result.destination.index, 0, moved)
    await reorder(ids)
  }

  async function handleDelete(field) {
    if (!confirm(`Excluir campo "${field.name}"? Todos os valores associados serão removidos.`)) return
    await removeField(field.id)
  }

  async function handleAdd({ name, type, options }) {
    const { error } = await addField({ name, type, options })
    if (!error) setAdding(false)
  }

  const editingField = fields.find(f => f.id === choicesEditor)

  return (
    <div className={styles.wrap}>
      <p className={styles.note}>
        Campos personalizados aparecem no <strong>modal de detalhes da tarefa</strong> e como
        <strong> colunas na visualização de Lista</strong>. O tipo não pode ser alterado depois
        — exclua e crie outro se precisar mudar.
      </p>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="custom-fields">
            {(provided) => (
              <div className={styles.list} ref={provided.innerRef} {...provided.droppableProps}>
                {fields.map((f, idx) => (
                  <Draggable key={f.id} draggableId={f.id} index={idx}>
                    {(dp, snap) => (
                      <div
                        ref={dp.innerRef}
                        {...dp.draggableProps}
                        className={`${styles.row} ${snap.isDragging ? styles.rowDragging : ''}`}
                      >
                        <FieldRow
                          field={f}
                          onUpdate={(patch) => updateField(f.id, patch)}
                          onDelete={() => handleDelete(f)}
                          onOpenChoices={() => setChoicesEditor(f.id)}
                          dragHandle={dp.dragHandleProps}
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

      {adding ? (
        <AddFieldForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <button className={styles.addBtn} onClick={() => setAdding(true)}>
          + Adicionar campo
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {/* Editor de choices em overlay leve */}
      {editingField && (
        <div className={styles.choicesOverlay} onClick={e => e.target === e.currentTarget && setChoicesEditor(null)}>
          <div className={styles.choicesModal}>
            <div className={styles.choicesHeader}>
              <h3 className={styles.choicesTitle}>Opções de "{editingField.name}"</h3>
              <button className={styles.choicesClose} onClick={() => setChoicesEditor(null)} aria-label="Fechar">✕</button>
            </div>
            <ChoicesEditor
              choices={editingField.options?.choices ?? []}
              onChange={(next) => updateField(editingField.id, { options: { ...editingField.options, choices: next } })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
