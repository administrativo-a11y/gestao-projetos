import { useState, useEffect, useRef } from 'react'
import { useCustomFields, FIELD_TYPES } from '../../hooks/useCustomFields'
import {
  STANDARD_COLUMN_ICONS, FIELD_TYPE_ICONS,
  IconSearch, IconClose, IconTrash,
} from '../shared/Icons'
import styles from './ColumnsPanel.module.css'

const STANDARD_COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Responsável' },
  { key: 'due_date', label: 'Prazo' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'last_comment', label: 'Últimos comentários' },
  { key: 'attachments', label: 'Anexos' },
]

function ColumnIcon({ columnKey, isCustom, fieldType }) {
  if (isCustom) {
    const Icon = FIELD_TYPE_ICONS[fieldType] ?? FIELD_TYPE_ICONS.text
    return <Icon size={14} />
  }
  const Icon = STANDARD_COLUMN_ICONS[columnKey] ?? FIELD_TYPE_ICONS.text
  return <Icon size={14} />
}

function ColumnRow({ label, iconNode, isOn, onToggle }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon}>{iconNode}</span>
      <span className={styles.rowLabel}>{label}</span>
      <label className={styles.switch}>
        <input type="checkbox" checked={isOn} onChange={onToggle} />
        <span className={styles.slider} />
      </label>
    </div>
  )
}

function NewFieldForm({ defaultType, onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [type, setType] = useState(defaultType)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ type, name: name.trim() })
  }

  return (
    <form className={styles.newForm} onSubmit={submit}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Nome do campo"
        value={name}
        onChange={e => setName(e.target.value)}
        className={styles.newFormInput}
      />
      <select
        className={styles.newFormSelect}
        value={type}
        onChange={e => setType(e.target.value)}
      >
        {FIELD_TYPES.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <div className={styles.newFormActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={styles.btnPrimary}>Criar</button>
      </div>
    </form>
  )
}

export default function ColumnsPanel({
  listId,
  hiddenKeys,
  onToggleVisibility,
  customFields: customFieldsProp,
  onClose,
}) {
  const { fields, addField, removeField } = useCustomFields(listId)
  const customFields = customFieldsProp ?? fields

  const [tab, setTab] = useState('existing')
  const [query, setQuery] = useState('')
  const [creatingType, setCreatingType] = useState(null) // tipo escolhido OU null

  function matches(text) {
    if (!query.trim()) return true
    return (text ?? '').toLowerCase().includes(query.trim().toLowerCase())
  }

  // Colunas existentes mostradas / ocultas
  const allItems = [
    ...STANDARD_COLUMNS.map(c => ({
      ...c,
      iconNode: <ColumnIcon columnKey={c.key} />,
    })),
    ...customFields.map(f => ({
      key: `cf:${f.id}`,
      label: f.name,
      iconNode: <ColumnIcon isCustom fieldType={f.type} />,
      isCustom: true,
      fieldId: f.id,
    })),
  ]
  const visible = allItems.filter(it => !hiddenKeys.has(it.key) && matches(it.label))
  const hidden = allItems.filter(it => hiddenKeys.has(it.key) && matches(it.label))

  async function handleCreateField({ type, name }) {
    const { error } = await addField({ name, type, options: needsChoices(type) ? defaultChoices() : {} })
    if (!error) {
      setCreatingType(null)
      setTab('existing')
    }
  }

  function needsChoices(t) { return t === 'select' || t === 'multi_select' }
  function defaultChoices() {
    return {
      choices: [
        { id: 'c_a', label: 'Aberto', color: '#378ADD' },
        { id: 'c_b', label: 'Concluído', color: '#1D9E75' },
      ],
    }
  }

  async function handleDeleteCustomField(item) {
    if (!confirm(`Excluir campo "${item.label}"? Valores associados serão removidos.`)) return
    await removeField(item.fieldId)
  }

  // Fecha com ESC
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel} role="dialog" aria-label="Campos">
        <header className={styles.header}>
          <h2 className={styles.title}>Campos</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <IconClose size={16} />
          </button>
        </header>

        <div className={styles.searchWrap}>
          <IconSearch size={14} />
          <input
            type="text"
            placeholder="Pesquise campos..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <nav className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'new' ? styles.tabActive : ''}`}
            onClick={() => setTab('new')}
          >
            Criar novo
          </button>
          <button
            className={`${styles.tab} ${tab === 'existing' ? styles.tabActive : ''}`}
            onClick={() => setTab('existing')}
          >
            Adicionar existente
          </button>
        </nav>

        <div className={styles.body}>
          {tab === 'new' && (
            <>
              {creatingType ? (
                <NewFieldForm
                  defaultType={creatingType}
                  onCreate={handleCreateField}
                  onCancel={() => setCreatingType(null)}
                />
              ) : (
                <div className={styles.typesList}>
                  <p className={styles.sectionHint}>Escolha um tipo de campo personalizado:</p>
                  {FIELD_TYPES.filter(t => matches(t.label)).map(t => {
                    const Icon = FIELD_TYPE_ICONS[t.id]
                    return (
                      <button
                        key={t.id}
                        className={styles.typeItem}
                        onClick={() => setCreatingType(t.id)}
                      >
                        <span className={styles.typeIcon}>{Icon ? <Icon size={14} /> : null}</span>
                        <span>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'existing' && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Mostrados</span>
                  <span className={styles.sectionCount}>{visible.length}</span>
                </div>
                {visible.length === 0 && (
                  <p className={styles.empty}>Nenhuma coluna visível.</p>
                )}
                {visible.map(it => (
                  <div key={it.key} className={styles.rowWrap}>
                    <ColumnRow
                      label={it.label}
                      iconNode={it.iconNode}
                      isOn={true}
                      onToggle={() => onToggleVisibility(it.key)}
                    />
                    {it.isCustom && (
                      <button
                        className={styles.miniDelete}
                        title="Excluir campo"
                        onClick={() => handleDeleteCustomField(it)}
                      >
                        <IconTrash size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Oculto</span>
                  <span className={styles.sectionCount}>{hidden.length}</span>
                </div>
                {hidden.length === 0 && (
                  <p className={styles.empty}>Nada oculto.</p>
                )}
                {hidden.map(it => (
                  <div key={it.key} className={styles.rowWrap}>
                    <ColumnRow
                      label={it.label}
                      iconNode={it.iconNode}
                      isOn={false}
                      onToggle={() => onToggleVisibility(it.key)}
                    />
                    {it.isCustom && (
                      <button
                        className={styles.miniDelete}
                        title="Excluir campo"
                        onClick={() => handleDeleteCustomField(it)}
                      >
                        <IconTrash size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
