import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AssigneePicker from './AssigneePicker'
import styles from './SubtaskRow.module.css'

export default function SubtaskRow({ subtask, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState(subtask.title)
  const [description, setDescription] = useState(subtask.description ?? '')
  const [dueDate, setDueDate] = useState(subtask.due_date ?? '')
  const [assigneeId, setAssigneeId] = useState(subtask.assignee_id ?? null)
  const [assigneeProfile, setAssigneeProfile] = useState(null)

  useEffect(() => {
    if (!subtask.assignee_id) { setAssigneeProfile(null); return }
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('id', subtask.assignee_id)
      .single()
      .then(({ data }) => { if (!cancelled) setAssigneeProfile(data) })
    return () => { cancelled = true }
  }, [subtask.assignee_id])

  async function toggleDone(e) {
    e.stopPropagation()
    await supabase.from('subtasks').update({ done: !subtask.done }).eq('id', subtask.id)
    onUpdate()
  }

  async function saveField(patch) {
    await supabase.from('subtasks').update(patch).eq('id', subtask.id)
    onUpdate()
  }

  function getInitials(n) {
    return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  const hasExtras = subtask.assignee_id || subtask.due_date || subtask.description
  const overdueClass = subtask.due_date && isPast(new Date(subtask.due_date)) && !subtask.done
    ? styles.overdue
    : isToday(new Date(subtask.due_date ?? '1970-01-01'))
    ? styles.today
    : ''

  return (
    <div className={`${styles.row} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.compact} onClick={() => setExpanded(v => !v)}>
        <input
          type="checkbox"
          checked={subtask.done}
          onChange={() => {}}
          onClick={toggleDone}
          className={styles.checkbox}
        />
        <span className={`${styles.title} ${subtask.done ? styles.titleDone : ''}`}>
          {subtask.title}
        </span>
        <div className={styles.compactMeta}>
          {subtask.due_date && (
            <span className={`${styles.duePill} ${overdueClass}`}>
              {format(new Date(subtask.due_date), 'dd MMM', { locale: ptBR })}
            </span>
          )}
          {assigneeProfile && (
            <span className={styles.assigneePill} title={assigneeProfile.name}>
              {assigneeProfile.avatar_url
                ? <img src={assigneeProfile.avatar_url} alt="" />
                : getInitials(assigneeProfile.name)}
            </span>
          )}
          {!hasExtras && (
            <span className={styles.addHint}>+ detalhes</span>
          )}
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={e => { e.stopPropagation(); onDelete(subtask.id) }}
            aria-label="Excluir subtarefa"
            title="Excluir"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.detail}>
          <div className={styles.field}>
            <label>Título</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => title !== subtask.title && saveField({ title })}
            />
          </div>

          <div className={styles.rowFields}>
            <div className={styles.field}>
              <label>Responsável</label>
              <AssigneePicker
                value={assigneeId}
                multi={false}
                onChange={v => { setAssigneeId(v); saveField({ assignee_id: v }) }}
              />
            </div>
            <div className={styles.field}>
              <label>Prazo</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => {
                  const v = e.target.value
                  setDueDate(v); saveField({ due_date: v || null })
                }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Descrição</label>
            <textarea
              rows={2}
              placeholder="Detalhes da subtarefa..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => description !== (subtask.description ?? '') && saveField({ description })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
