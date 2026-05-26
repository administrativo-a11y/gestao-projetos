import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTasks } from '../../hooks/useTasks'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../hooks/useApp'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import modalStyles from '../shared/Modal.module.css'
import styles from './TaskDetail.module.css'

export default function TaskDetailModal({ task, statuses, listId, onClose }) {
  const { updateTask, softDeleteTask, undoDeleteTask } = useTasks(listId)
  const { user } = useAuth()
  const { showUndo } = useApp()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [statusId, setStatusId] = useState(task.status_id)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [subtasks, setSubtasks] = useState(task.subtasks ?? [])
  const [comments, setComments] = useState([])
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchComments() }, [task.id])

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(name)')
      .eq('task_id', task.id)
      .order('created_at')
    setComments(data ?? [])
  }

  async function handleSave() {
    setSaving(true)
    await updateTask(task.id, { title, description, priority, status_id: statusId, due_date: dueDate || null })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    await softDeleteTask(task.id)
    onClose()
  }

  async function toggleSubtask(id, done) {
    await supabase.from('subtasks').update({ done: !done }).eq('id', id)
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !done } : s))
  }

  async function addSubtask(e) {
    e.preventDefault()
    if (!newSubtask.trim()) return
    const { data } = await supabase.from('subtasks').insert({ task_id: task.id, title: newSubtask.trim(), position: subtasks.length }).select().single()
    if (data) setSubtasks(prev => [...prev, data])
    setNewSubtask('')
  }

  async function addComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    await supabase.from('comments').insert({ task_id: task.id, user_id: user.id, content: newComment.trim() })
    setNewComment('')
    fetchComments()
  }

  const doneCount = subtasks.filter(s => s.done).length

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal} ${styles.detailModal}`} role="dialog">
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>Detalhe da tarefa</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.deleteBtn} onClick={handleDelete} aria-label="Excluir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
            <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.main}>
            <div className={modalStyles.field}>
              <label>Título</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className={modalStyles.field}>
              <label>Descrição</label>
              <textarea rows={3} placeholder="Detalhes..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className={styles.metaRow}>
              <div className={modalStyles.field}>
                <label>Status</label>
                <select value={statusId} onChange={e => setStatusId(e.target.value)}>
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className={modalStyles.field}>
                <label>Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              <div className={modalStyles.field}>
                <label>Prazo</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Subtarefas</span>
                {subtasks.length > 0 && <span className={styles.sectionCount}>{doneCount}/{subtasks.length}</span>}
              </div>
              {subtasks.length > 0 && (
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${(doneCount / subtasks.length) * 100}%` }} />
                </div>
              )}
              <div className={styles.subtaskList}>
                {subtasks.map(s => (
                  <label key={s.id} className={styles.subtaskItem}>
                    <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s.id, s.done)} className={styles.checkbox} />
                    <span className={s.done ? styles.subtaskDone : ''}>{s.title}</span>
                  </label>
                ))}
              </div>
              <form onSubmit={addSubtask} className={styles.addSubtask}>
                <input type="text" placeholder="Adicionar subtarefa..." value={newSubtask} onChange={e => setNewSubtask(e.target.value)} />
                <button type="submit" className={styles.addSubtaskBtn} aria-label="Adicionar">+</button>
              </form>
            </div>
          </div>

          <div className={styles.sidebar}>
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Comentários</span>
              <div className={styles.commentList}>
                {comments.map(c => (
                  <div key={c.id} className={styles.comment}>
                    <span className={styles.commentAvatar}>{c.profiles?.name?.[0]?.toUpperCase() ?? '?'}</span>
                    <div className={styles.commentBody}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthor}>{c.profiles?.name}</span>
                        <span className={styles.commentDate}>{format(new Date(c.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <p className={styles.commentText}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={addComment} className={styles.commentForm}>
                <textarea placeholder="Escreva um comentário..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} />
                <button type="submit" className={modalStyles.btnPrimary} style={{ alignSelf: 'flex-end', padding: '6px 14px', fontSize: 12 }}>Enviar</button>
              </form>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={modalStyles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={modalStyles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
