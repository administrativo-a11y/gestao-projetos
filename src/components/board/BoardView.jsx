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
import styles from './Board.module.css'

export default function BoardView() {
  const { activeList } = useApp()
  const { user } = useAuth()
  const { statuses, tasks, loading, moveTask } = useTasks(activeList?.id)
  const { filters } = useTaskFilters()
  const filteredTasks = useMemo(
    () => applyFilters(tasks, statuses, filters, user?.id),
    [tasks, statuses, filters, user?.id]
  )
  const [newTaskStatus, setNewTaskStatus] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)

  function getStatusTasks(statusId) {
    return filteredTasks.filter(t => t.status_id === statusId).sort((a, b) => a.position - b.position)
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
                      {statusTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''}`}
                              onClick={() => setSelectedTask(task)}
                            >
                              <p className={styles.cardTitle}>{task.title}</p>
                              <div className={styles.cardMeta}>
                                {task.task_tags?.map(tt => (
                                  <span key={tt.tag_id} className={styles.tag} style={{ background: tt.tags?.color + '22', color: tt.tags?.color }}>
                                    {tt.tags?.name}
                                  </span>
                                ))}
                                {task.priority === 'high' && <span className={styles.priorityHigh}>↑ Alta</span>}
                                {task.due_date && (
                                  <span className={`${styles.dueDate} ${isPast(new Date(task.due_date)) ? styles.overdue : isToday(new Date(task.due_date)) ? styles.dueToday : ''}`}>
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
                      ))}
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
