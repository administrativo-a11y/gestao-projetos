import { useState, useMemo } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../hooks/useAuth'
import { useTaskFilters, applyFilters } from '../../hooks/useTaskFilters'
import { useTaskFromQuery, taskShareUrl } from '../../hooks/useTaskFromQuery'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TaskDetailModal from '../board/TaskDetailModal'
import NewTaskModal from '../board/NewTaskModal'
import TaskQuickActions from '../task/TaskQuickActions'
import styles from './ListView.module.css'

const PRIORITY_LABEL = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const PRIORITY_CLASS = { high: 'priorityHigh', medium: 'priorityMed', low: 'priorityLow' }

export default function ListView() {
  const { activeList } = useApp()
  const { user } = useAuth()
  const { statuses, tasks, loading, toggleDone, duplicateTask, softDeleteTask } = useTasks(activeList?.id)
  const { filters } = useTaskFilters()
  const filteredTasks = useMemo(
    () => applyFilters(tasks, statuses, filters, user?.id),
    [tasks, statuses, filters, user?.id]
  )
  const [selectedTask, setSelectedTask] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [sortBy, setSortBy] = useState('position')
  const [groupBy, setGroupBy] = useState('none')

  const { clearTaskParam } = useTaskFromQuery(tasks, setSelectedTask, () => setSelectedTask(null))

  async function copyTaskLink(task) {
    const url = taskShareUrl(task, activeList)
    try { await navigator.clipboard.writeText(url) }
    catch { window.prompt('Link da tarefa:', url) }
  }

  function closeTask() {
    setSelectedTask(null)
    clearTaskParam()
  }

  const sorted = [...filteredTasks].sort((a, b) => {
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

  function getStatus(statusId) {
    return statuses.find(s => s.id === statusId)
  }

  const doneStatusId = statuses.find(s => /conclu/i.test(s.name))?.id

  if (!activeList) return null
  if (loading) return <div className={styles.loading}>Carregando...</div>

  // Agrupado por status
  const groups = groupBy === 'status'
    ? statuses.map(s => ({ status: s, items: sorted.filter(t => t.status_id === s.id) }))
    : [{ status: null, items: sorted }]

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <span className={styles.count}>
            {filteredTasks.length} {filteredTasks.length === tasks.length ? 'tarefas' : `de ${tasks.length}`}
          </span>
          <div className={styles.sortRow}>
            <span className={styles.sortLabel}>Agrupar</span>
            <select className={styles.sortSelect} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
              <option value="none">Sem agrupamento</option>
              <option value="status">Status</option>
            </select>
            <span className={styles.sortLabel}>Ordenar</span>
            <select className={styles.sortSelect} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="position">Padrão</option>
              <option value="priority">Prioridade</option>
              <option value="due_date">Prazo</option>
            </select>
          </div>
        </div>

        {groups.map((group, gi) => (
          <div key={group.status?.id ?? `g${gi}`} className={styles.group}>
            {group.status && (
              <div className={styles.groupHeader}>
                <span className={styles.groupDot} style={{ background: group.status.color }} />
                <span className={styles.groupName}>{group.status.name}</span>
                <span className={styles.groupCount}>{group.items.length}</span>
              </div>
            )}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thTitle}>Tarefa</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Responsável</th>
                  <th className={styles.th}>Prazo</th>
                  <th className={styles.th}>Prioridade</th>
                  <th className={styles.thActions} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {group.items.map(task => {
                  const status = getStatus(task.status_id)
                  const isDone = doneStatusId && task.status_id === doneStatusId
                  return (
                    <tr
                      key={task.id}
                      className={`${styles.row} ${isDone ? styles.rowDone : ''}`}
                      onClick={() => setSelectedTask(task)}
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setSelectedTask(task)}
                    >
                      <td className={styles.tdTitle}>{task.title}</td>
                      <td className={styles.td}>
                        {status && (
                          <span
                            className={styles.statusPill}
                            style={{ background: status.color + '22', color: status.color }}
                          >
                            {status.name}
                          </span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <div className={styles.assignees}>
                          {task.task_assignees?.map(a => (
                            <span key={a.user_id} className={styles.avatar} title={a.profiles?.name}>
                              {a.profiles?.name?.[0]?.toUpperCase() ?? '?'}
                            </span>
                          ))}
                          {(!task.task_assignees || task.task_assignees.length === 0) && (
                            <span className={styles.none}>—</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.td}>
                        {task.due_date ? (
                          <span className={`${styles.dueDate} ${
                            isPast(new Date(task.due_date)) && task.status_id !== doneStatusId
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
                      <td className={styles.tdActions}>
                        <div className={styles.actionsWrap}>
                          <TaskQuickActions
                            task={task}
                            isDone={isDone}
                            onToggleDone={t => toggleDone(t.id)}
                            onDuplicate={t => duplicateTask(t.id)}
                            onCopyLink={copyTaskLink}
                            onDelete={t => softDeleteTask(t.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

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
          statuses={statuses}
          listId={activeList.id}
          onClose={closeTask}
        />
      )}

      {showNewTask && statuses.length > 0 && (
        <NewTaskModal
          statusId={statuses[0].id}
          listId={activeList.id}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </>
  )
}
