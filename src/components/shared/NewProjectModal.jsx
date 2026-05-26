import { useState } from 'react'
import { useProjects } from '../../hooks/useProjects'
import styles from './Modal.module.css'

const COLORS = ['#1D9E75','#378ADD','#EF9F27','#7F77DD','#E24B4A','#D4537E','#888780']

export default function NewProjectModal({ onClose }) {
  const { createProject, refetch } = useProjects()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Informe o nome do projeto.'); return }
    setLoading(true)
    const { error } = await createProject({ name: name.trim(), description: description.trim(), color })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      await refetch()
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-labelledby="modal-title">
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>Novo projeto</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="proj-name">Nome do projeto</label>
            <input
              id="proj-name"
              type="text"
              placeholder="Ex: Solar / GD, Gold Nexiall..."
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="proj-desc">Descrição (opcional)</label>
            <textarea
              id="proj-desc"
              placeholder="Breve descrição do projeto"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className={styles.field}>
            <label>Cor</label>
            <div className={styles.colorRow}>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorDot} ${color === c ? styles.colorSelected : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Criando...' : 'Criar projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
