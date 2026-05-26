import { useState } from 'react'
import { useTasks } from '../../hooks/useTasks'
import modalStyles from '../shared/Modal.module.css'

export default function NewTaskModal({ statusId, listId, onClose }) {
  const { createTask } = useTasks(listId)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Informe o título.'); return }
    setLoading(true)
    const { error } = await createTask({ statusId, title: title.trim(), priority, dueDate: dueDate || null })
    if (error) { setError(error.message); setLoading(false) }
    else onClose()
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal} role="dialog" aria-labelledby="new-task-title">
        <div className={modalStyles.header}>
          <h2 id="new-task-title" className={modalStyles.title}>Nova tarefa</h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className={modalStyles.form}>
          <div className={modalStyles.field}>
            <label htmlFor="task-title">Título</label>
            <input id="task-title" type="text" placeholder="Descreva a tarefa..." value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div className={modalStyles.field}>
            <label htmlFor="task-priority">Prioridade</label>
            <select id="task-priority" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <div className={modalStyles.field}>
            <label htmlFor="task-due">Prazo (opcional)</label>
            <input id="task-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          {error && <p className={modalStyles.error}>{error}</p>}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={modalStyles.btnPrimary} disabled={loading}>{loading ? 'Criando...' : 'Criar tarefa'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
