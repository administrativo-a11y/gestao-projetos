import { useState, useEffect, useRef } from 'react'
import { useCustomFields, FIELD_TYPES } from '../../hooks/useCustomFields'
import styles from './ColumnsPanel.module.css'

const STANDARD_COLUMNS = [
  { key: 'status', label: 'Status', icon: '◐' },
  { key: 'assignee', label: 'Responsável', icon: '👤' },
  { key: 'due_date', label: 'Prazo', icon: '📅' },
  { key: 'priority', label: 'Prioridade', icon: '⬆' },
  { key: 'last_comment', label: 'Últimos comentários', icon: '💬' },
  { key: 'attachments', label: 'Anexos', icon: '📎' },
]

const TYPE_ICONS = {
  text: 'T', number: '#', date: '📅', select: '◉', multi_select: '☰',
  user: '👤', checkbox: '☑', currency: '$', url: '🔗', email: '✉', phone: '☎',
}

function ColumnRow({ label, icon, isOn, onToggle }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon}>{icon}</span>
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
    ...STANDARD_COLUMNS,
    ...customFields.map(f => ({
      key: `cf:${f.id}`,
      label: f.name,
      icon: TYPE_ICONS[f.type] ?? '◇',
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <div className={styles.searchWrap}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
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
                  {FIELD_TYPES.filter(t => matches(t.label)).map(t => (
                    <button
                      key={t.id}
                      className={styles.typeItem}
                      onClick={() => setCreatingType(t.id)}
                    >
                      <span className={styles.typeIcon}>{TYPE_ICONS[t.id] ?? '◇'}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
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
                      icon={it.icon}
                      isOn={true}
                      onToggle={() => onToggleVisibility(it.key)}
                    />
                    {it.isCustom && (
                      <button
                        className={styles.miniDelete}
                        title="Excluir campo"
                        onClick={() => handleDeleteCustomField(it)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
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
                      icon={it.icon}
                      isOn={false}
                      onToggle={() => onToggleVisibility(it.key)}
                    />
                    {it.isCustom && (
                      <button
                        className={styles.miniDelete}
                        title="Excluir campo"
                        onClick={() => handleDeleteCustomField(it)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
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
