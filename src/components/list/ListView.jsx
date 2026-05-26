import { useState } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TaskDetailModal from '../board/TaskDetailModal'
import NewTaskModal from '../board/NewTaskModal'
import styles from './ListView.module.css'

const PRIORITY_LABEL = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const PRIORITY_CLASS = { high: 'priorityHigh', medium: 'priorityMed', low: 'priorityLow' }

export default function ListView({ projectId }) {
  const { columns, tasks, members, loading } = useTasks(projectId)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [sortBy, setSortBy] = useState('position')

  const sorted = [...tasks].sort((a, b) => {
    if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    }
    if (sortBy === 'due_date') {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date) - new Date(b.due_date)
    }
    return a.position - b.position
  })

  function getColumnName(colId) {
    return columns.find(c => c.id === colId)?.name ?? ''
  }

  function getColumnColor(colId) {
    return columns.find(c => c.id === colId)?.color ?? '#888'
  }

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <span className={styles.count}>{tasks.length} tarefas</span>
          <div className={styles.sortRow}>
            <span className={styles.sortLabel}>Ordenar por</span>
            <select className={styles.sortSelect} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="position">Padrão</option>
              <option value="priority">Prioridade</option>
              <option value="due_date">Prazo</option>
            </select>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thTitle}>Tarefa</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Responsável</th>
              <th className={styles.th}>Prazo</th>
              <th className={styles.th}>Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(task => (
              <tr key={task.id} className={styles.row} onClick={() => setSelectedTask(task)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedTask(task)}>
                <td className={styles.tdTitle}>{task.title}</td>
                <td className={styles.td}>
                  <span
                    className={styles.statusPill}
                    style={{
                      background: getColumnColor(task.column_id) + '22',
                      color: getColumnColor(task.column_id)
                    }}
                  >
                    {getColumnName(task.column_id)}
                  </span>
                </td>
                <td className={styles.td}>
                  <div className={styles.assignees}>
                    {task.task_assignees?.map(a => (
                      <span key={a.user_id} className={styles.avatar} title={a.profiles?.name}>
                        {a.profiles?.avatar_initials ?? '?'}
                      </span>
                    ))}
                    {task.task_assignees?.length === 0 && (
                      <span className={styles.none}>—</span>
                    )}
                  </div>
                </td>
                <td className={styles.td}>
                  {task.due_date ? (
                    <span className={`${styles.dueDate} ${
                      isPast(new Date(task.due_date)) && getColumnName(task.column_id) !== 'Concluído'
                        ? styles.overdue
                        : isToday(new Date(task.due_date))
                        ? styles.today
                        : ''
                    }`}>
                      {format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}
                    </span>
                  ) : <span className={styles.none}>—</span>}
                </td>
                <td className={styles.td}>
                  <span className={styles[PRIORITY_CLASS[task.priority]]}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className={styles.addRow} onClick={() => setShowNewTask(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Adicionar tarefa
        </button>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          members={members}
          columns={columns}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showNewTask && columns.length > 0 && (
        <NewTaskModal
          columnId={columns[0].id}
          projectId={projectId}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </>
  )
}
