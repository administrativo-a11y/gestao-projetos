import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../hooks/useAuth'
import { useTaskFilters, applyFilters } from '../../hooks/useTaskFilters'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import NewTaskModal from './NewTaskModal'
import TaskDetailModal from './TaskDetailModal'
import ContextMenu from '../shared/ContextMenu'
import styles from './Board.module.css'

const CheckIcon = ({ filled }) => (
  filled ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10" stroke="var(--color-surface)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
)

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

export default function BoardView() {
  const { activeList } = useApp()
  const { user } = useAuth()
  const { statuses, tasks, loading, moveTask, toggleDone, duplicateTask, softDeleteTask } = useTasks(activeList?.id)
  const { filters } = useTaskFilters()
  const filteredTasks = useMemo(
    () => applyFilters(tasks, statuses, filters, user?.id),
    [tasks, statuses, filters, user?.id]
  )
  const [newTaskStatus, setNewTaskStatus] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)

  const doneStatusId = useMemo(
    () => statuses.find(s => /^conclu/i.test(s.name))?.id,
    [statuses]
  )

  function getStatusTasks(statusId) {
    return filteredTasks.filter(t => t.status_id === statusId).sort((a, b) => a.position - b.position)
  }

  async function copyTaskLink(task) {
    const url = `${window.location.origin}/space/${activeList?.space_id}/list/${activeList?.id}?task=${task.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Link da tarefa:', url)
    }
  }

  async function onDragEnd(result) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    await moveTask(draggableId, destination.droppableId, destination.index)
  }

  if (!activeList) return (
    <div className={styles.empty}>
      <p>Selecione uma lista na sidebar para ver as tarefas.</p>
    </div>
  )

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={styles.board}>
          {statuses.map(status => {
            const statusTasks = getStatusTasks(status.id)
            return (
              <div key={status.id} className={styles.column}>
                <div className={styles.colHeader}>
                  <span className={styles.colDot} style={{ background: status.color }} />
                  <span className={styles.colTitle}>{status.name}</span>
                  <span className={styles.colCount}>{statusTasks.length}</span>
                </div>

                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`${styles.dropzone} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
                    >
                      {statusTasks.map((task, index) => {
                        const isDone = doneStatusId && task.status_id === doneStatusId
                        return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''} ${isDone ? styles.cardDone : ''}`}
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className={styles.cardHeader}>
                                <p className={styles.cardTitle}>{task.title}</p>
                                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                                  <button
                                    className={`${styles.actionBtn} ${isDone ? styles.actionBtnDone : ''}`}
                                    onClick={() => toggleDone(task.id)}
                                    title={isDone ? 'Reabrir' : 'Concluir'}
                                    aria-label={isDone ? 'Reabrir' : 'Concluir'}
                                  >
                                    <CheckIcon filled={isDone} />
                                  </button>
                                  <button
                                    className={styles.actionBtn}
                                    onClick={() => duplicateTask(task.id)}
                                    title="Duplicar"
                                    aria-label="Duplicar"
                                  >
                                    <CopyIcon />
                                  </button>
                                  <ContextMenu
                                    trigger={
                                      <button
                                        className={styles.actionBtn}
                                        title="Mais"
                                        aria-label="Mais ações"
                                      >
                                        <DotsIcon />
                                      </button>
                                    }
                                    items={[
                                      { label: 'Copiar link', icon: <LinkIcon />, onClick: () => copyTaskLink(task) },
                                      { label: 'Duplicar', icon: <CopyIcon />, onClick: () => duplicateTask(task.id) },
                                      { separator: true },
                                      { label: 'Excluir', icon: <TrashIcon />, danger: true, onClick: () => softDeleteTask(task.id) },
                                    ]}
                                  />
                                </div>
                              </div>
                              <div className={styles.cardMeta}>
                                {task.task_tags?.map(tt => (
                                  <span key={tt.tag_id} className={styles.tag} style={{ background: tt.tags?.color + '22', color: tt.tags?.color }}>
                                    {tt.tags?.name}
                                  </span>
                                ))}
                                {task.priority === 'high' && <span className={styles.priorityHigh}>↑ Alta</span>}
                                {task.due_date && (
                                  <span className={`${styles.dueDate} ${isPast(new Date(task.due_date)) && !isDone ? styles.overdue : isToday(new Date(task.due_date)) ? styles.dueToday : ''}`}>
                                    {format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}
                                  </span>
                                )}
                                <div className={styles.assignees}>
                                  {task.task_assignees?.slice(0, 3).map(a => (
                                    <span key={a.user_id} className={styles.avatar} title={a.profiles?.name}>
                                      {a.profiles?.name?.[0]?.toUpperCase() ?? '?'}
                                    </span>
                                  ))}
                                </div>
                                {task.subtasks?.length > 0 && (
                                  <span className={styles.subtaskCount}>
                                    {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      )})}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <button className={styles.addCard} onClick={() => setNewTaskStatus(status.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Adicionar tarefa
                </button>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {newTaskStatus && (
        <NewTaskModal statusId={newTaskStatus} listId={activeList.id} onClose={() => setNewTaskStatus(null)} />
      )}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} statuses={statuses} listId={activeList.id} onClose={() => setSelectedTask(null)} />
      )}
    </>
  )
}
