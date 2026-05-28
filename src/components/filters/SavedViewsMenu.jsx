import { useState, useRef, useEffect } from 'react'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useTaskFilters, EMPTY_FILTERS } from '../../hooks/useTaskFilters'
import { useApp } from '../../hooks/useApp'
import { useSearchParams } from 'react-router-dom'
import styles from './SavedViewsMenu.module.css'

export default function SavedViewsMenu({ currentView, setView }) {
  const { activeList } = useApp()
  const { views, loading, save, remove } = useSavedViews(activeList?.id)
  const { filters, setFilters, isActive } = useTaskFilters()
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    function h(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    await save({
      name: name.trim(),
      config: { filters, view: currentView },
    })
    setName('')
    setNaming(false)
  }

  function applyView(view) {
    if (view.config?.filters) {
      setFilters(view.config.filters)
    } else {
      setFilters(EMPTY_FILTERS)
    }
    if (view.config?.view && setView) setView(view.config.view)
    setOpen(false)
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS)
    setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button className={styles.trigger} onClick={() => setOpen(v => !v)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        Visualizações
        {views.length > 0 && <span className={styles.count}>{views.length}</span>}
      </button>

      {open && (
        <div className={styles.menu}>
          {loading && <div className={styles.empty}>Carregando...</div>}
          {!loading && views.length === 0 && (
            <div className={styles.empty}>Nenhuma visualização salva ainda.</div>
          )}
          {views.map(v => (
            <div key={v.id} className={styles.menuItem}>
              <button className={styles.menuItemMain} onClick={() => applyView(v)}>
                {v.name}
              </button>
              <button className={styles.menuItemDelete} onClick={() => remove(v.id)} title="Excluir">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}

          <div className={styles.separator} />

          {!naming ? (
            <button
              className={styles.saveBtn}
              onClick={() => setNaming(true)}
              disabled={!isActive}
              title={!isActive ? 'Aplique filtros antes de salvar' : ''}
            >
              + Salvar visualização atual
            </button>
          ) : (
            <form onSubmit={handleSave} className={styles.saveForm}>
              <input
                type="text"
                placeholder="Nome da visualização"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              <div className={styles.saveActions}>
                <button type="button" onClick={() => { setNaming(false); setName('') }} className={styles.cancelBtn}>Cancelar</button>
                <button type="submit" className={styles.confirmBtn}>Salvar</button>
              </div>
            </form>
          )}

          {isActive && (
            <button className={styles.clearAll} onClick={clearAll}>Limpar filtros</button>
          )}
        </div>
      )}
    </div>
  )
}
