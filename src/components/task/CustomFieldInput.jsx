import { useState, useEffect, useRef } from 'react'
import AssigneePicker from './AssigneePicker'
import styles from './CustomField.module.css'

const URL_RE = /^https?:\/\/.+/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatCurrency(n, currency = 'BRL') {
  if (n === null || n === undefined || n === '') return ''
  const num = Number(n)
  if (Number.isNaN(num)) return ''
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(num)
  } catch {
    return `R$ ${num.toFixed(2)}`
  }
}

function MultiSelectField({ choices, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = Array.isArray(value) ? value : []

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function toggle(id) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id]
    onChange(next)
  }

  const selectedChoices = (choices ?? []).filter(c => selected.includes(c.id))

  return (
    <div className={styles.multiWrap} ref={ref}>
      <button type="button" className={styles.multiTrigger} onClick={() => setOpen(v => !v)}>
        {selectedChoices.length === 0 ? (
          <span className={styles.placeholder}>Selecionar...</span>
        ) : (
          <span className={styles.pills}>
            {selectedChoices.map(c => (
              <span key={c.id} className={styles.pill} style={{ background: (c.color ?? '#888') + '22', color: c.color }}>
                {c.label}
              </span>
            ))}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.multiMenu}>
          {(choices ?? []).length === 0 && <div className={styles.empty}>Sem opções configuradas</div>}
          {(choices ?? []).map(c => (
            <label key={c.id} className={styles.checkRow}>
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              <span className={styles.dot} style={{ background: c.color ?? '#888' }} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CustomFieldInput({ field, value, onChange, debounceMs = 350 }) {
  const [local, setLocal] = useState(value ?? '')
  const debounceRef = useRef(null)

  useEffect(() => { setLocal(value ?? '') }, [value])

  function debouncedSave(v) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(v), debounceMs)
  }

  function handleText(e) {
    const v = e.target.value
    setLocal(v)
    debouncedSave(v)
  }

  function handleNumber(e) {
    const raw = e.target.value
    setLocal(raw)
    if (raw === '') { debouncedSave(null); return }
    const n = parseFloat(raw)
    debouncedSave(Number.isFinite(n) ? n : null)
  }

  function handleImmediate(v) {
    setLocal(v)
    onChange(v)
  }

  const t = field.type

  if (t === 'text' || t === 'url' || t === 'email' || t === 'phone') {
    const invalid =
      (t === 'url' && local && !URL_RE.test(local)) ||
      (t === 'email' && local && !EMAIL_RE.test(local))
    return (
      <input
        type={t === 'email' ? 'email' : (t === 'url' ? 'url' : 'text')}
        className={`${styles.input} ${invalid ? styles.invalid : ''}`}
        value={local}
        onChange={handleText}
        onBlur={() => onChange(local)}
        placeholder={
          t === 'url' ? 'https://...' :
          t === 'email' ? 'nome@exemplo.com' :
          t === 'phone' ? '(11) 98765-4321' : ''
        }
      />
    )
  }

  if (t === 'number') {
    return (
      <input
        type="number"
        className={styles.input}
        value={local ?? ''}
        onChange={handleNumber}
        onBlur={() => {
          if (local === '' || local === null) { onChange(null); return }
          const n = parseFloat(local)
          onChange(Number.isFinite(n) ? n : null)
        }}
      />
    )
  }

  if (t === 'currency') {
    return (
      <div className={styles.currencyWrap}>
        <span className={styles.currencyPrefix}>R$</span>
        <input
          type="number"
          step="0.01"
          className={`${styles.input} ${styles.currencyInput}`}
          value={local ?? ''}
          onChange={handleNumber}
          onBlur={() => {
            if (local === '' || local === null) { onChange(null); return }
            const n = parseFloat(local)
            onChange(Number.isFinite(n) ? n : null)
          }}
          placeholder="0,00"
        />
      </div>
    )
  }

  if (t === 'date') {
    return (
      <input
        type="date"
        className={styles.input}
        value={value ?? ''}
        onChange={e => handleImmediate(e.target.value || null)}
      />
    )
  }

  if (t === 'checkbox') {
    return (
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => handleImmediate(e.target.checked)}
        />
        <span>{value ? 'Sim' : 'Não'}</span>
      </label>
    )
  }

  if (t === 'select') {
    const choices = field.options?.choices ?? []
    return (
      <select
        className={styles.input}
        value={value ?? ''}
        onChange={e => handleImmediate(e.target.value || null)}
      >
        <option value="">— sem valor —</option>
        {choices.map(c => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
    )
  }

  if (t === 'multi_select') {
    const choices = field.options?.choices ?? []
    return <MultiSelectField choices={choices} value={value} onChange={handleImmediate} />
  }

  if (t === 'user') {
    return (
      <AssigneePicker
        value={value ?? null}
        multi={false}
        onChange={(v) => handleImmediate(v)}
        placeholder="Sem pessoa"
      />
    )
  }

  return <input className={styles.input} value={local} onChange={handleText} />
}

// Exporta helper de formatação pra usar no Display
export { formatCurrency, URL_RE, EMAIL_RE }
