import { Fragment, useState, useMemo, useEffect, useCallback } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../hooks/useAuth'
import { useCustomFields } from '../../hooks/useCustomFields'
import { useSpaceMembers } from '../../hooks/useSpaceMembers'
import { useTaskFilters, applyFilters } from '../../hooks/useTaskFilters'
import { useTaskFromQuery, taskShareUrl } from '../../hooks/useTaskFromQuery'
import CustomFieldDisplay from '../task/CustomFieldDisplay'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TaskDetailModal from '../board/TaskDetailModal'
import NewTaskModal from '../board/NewTaskModal'
import TaskQuickActions from '../task/TaskQuickActions'
import ColumnsPanel from './ColumnsPanel'
import { formatDistanceToNow } from 'date-fns'
import styles from './ListView.module.css'

const PRIORITY_LABEL = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const PRIORITY_CLASS = { high: 'priorityHigh', medium: 'priorityMed', low: 'priorityLow' }
const STANDARD_KEYS = ['status', 'assignee', 'due_date', 'priority', 'last_comment', 'attachments']
const ORDER_KEY = (listId) => `gp.col_order.${listId}`
const COLLAPSED_KEY = (listId) => `gp.collapsed_groups.${listId}`
const HIDDEN_KEY = (listId) => `gp.hidden_cols.${listId}`
const EXPANDED_DESC_KEY = (listId) => `gp.expanded_desc.${listId}`

const Chevron = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const GripIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/>
    <circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/>
    <circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>
  </svg>
)

function getInitials(n) {
  return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

export default function ListView() {
  const { activeList, activeSpace } = useApp()
  const { user } = useAuth()
  const { statuses, tasks, loading, toggleDone, duplicateTask, softDeleteTask } = useTasks(activeList?.id)
  const { fields: customFields } = useCustomFields(activeList?.id)
  const { members } = useSpaceMembers(activeSpace?.id)
  const { filters } = useTaskFilters()
  const filteredTasks = useMemo(
    () => applyFilters(tasks, statuses, filters, user?.id),
    [tasks, statuses, filters, user?.id]
  )
  const [selectedTask, setSelectedTask] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [sortBy, setSortBy] = useState('position')
  const [groupBy, setGroupBy] = useState('none')
  const [showPanel, setShowPanel] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState(new Set())

  // ── Column order (per usuário, por lista) ──────────────────────────
  const defaultOrder = useMemo(
    () => [...STANDARD_KEYS, ...customFields.map(f => `cf:${f.id}`)],
    [customFields]
  )
  const [columnOrder, setColumnOrder] = useState(defaultOrder)

  // Carrega/sincroniza com customFields que aparecem/somem
  useEffect(() => {
    if (!activeList?.id) return
    let saved = null
    try {
      const raw = localStorage.getItem(ORDER_KEY(activeList.id))
      if (raw) saved = JSON.parse(raw)
    } catch { /* ignore */ }
    const base = Array.isArray(saved) ? saved : defaultOrder
    const valid = new Set(defaultOrder)
    const filtered = base.filter(k => valid.has(k))
    const missing = defaultOrder.filter(k => !filtered.includes(k))
    setColumnOrder([...filtered, ...missing])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList?.id, customFields.map(f => f.id).join(',')])

  function persistOrder(order) {
    try { localStorage.setItem(ORDER_KEY(activeList.id), JSON.stringify(order)) } catch { /* ignore */ }
  }

  // ── Collapsed groups ───────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())
  useEffect(() => {
    if (!activeList?.id) return
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY(activeList.id))
      setCollapsedGroups(raw ? new Set(JSON.parse(raw)) : new Set())
    } catch { setCollapsedGroups(new Set()) }
  }, [activeList?.id])

  // ── Hidden columns ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeList?.id) return
    try {
      const raw = localStorage.getItem(HIDDEN_KEY(activeList.id))
      setHiddenColumns(raw ? new Set(JSON.parse(raw)) : new Set())
    } catch { setHiddenColumns(new Set()) }
  }, [activeList?.id])

  // ── Expanded descriptions ──────────────────────────────────────────
  const [expandedDesc, setExpandedDesc] = useState(() => new Set())
  useEffect(() => {
    if (!activeList?.id) return
    try {
      const raw = localStorage.getItem(EXPANDED_DESC_KEY(activeList.id))
      setExpandedDesc(raw ? new Set(JSON.parse(raw)) : new Set())
    } catch { setExpandedDesc(new Set()) }
  }, [activeList?.id])

  function toggleDescription(taskId, e) {
    if (e) e.stopPropagation()
    setExpandedDesc(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      try { localStorage.setItem(EXPANDED_DESC_KEY(activeList.id), JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const tasksWithDescription = useMemo(
    () => filteredTasks.filter(t => (t.description ?? '').trim().length > 0),
    [filteredTasks]
  )
  const allExpanded = tasksWithDescription.length > 0 &&
    tasksWithDescription.every(t => expandedDesc.has(t.id))

  function toggleAllDescriptions() {
    if (allExpanded) {
      setExpandedDesc(new Set())
      try { localStorage.setItem(EXPANDED_DESC_KEY(activeList.id), JSON.stringify([])) } catch { /* ignore */ }
    } else {
      const next = new Set(tasksWithDescription.map(t => t.id))
      setExpandedDesc(next)
      try { localStorage.setItem(EXPANDED_DESC_KEY(activeList.id), JSON.stringify([...next])) } catch { /* ignore */ }
    }
  }

  function toggleColumnVisibility(key) {
    setHiddenColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(HIDDEN_KEY(activeList.id), JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function toggleGroup(key) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(COLLAPSED_KEY(activeList.id), JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  // ── Drag handlers (HTML5 native) ───────────────────────────────────
  const [draggedKey, setDraggedKey] = useState(null)
  const [dragOverKey, setDragOverKey] = useState(null)

  function handleDragStart(e, key) {
    setDraggedKey(key)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', key) } catch { /* ignore */ }
  }
  function handleDragOver(e, key) {
    e.preventDefault()
    if (key !== dragOverKey) setDragOverKey(key)
    e.dataTransfer.dropEffect = 'move'
  }
  function handleDrop(e, targetKey) {
    e.preventDefault()
    if (!draggedKey || draggedKey === targetKey) { reset(); return }
    const next = [...columnOrder]
    const fromIdx = next.indexOf(draggedKey)
    const toIdx = next.indexOf(targetKey)
    if (fromIdx === -1 || toIdx === -1) { reset(); return }
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, draggedKey)
    setColumnOrder(next)
    persistOrder(next)
    reset()
  }
  function reset() { setDraggedKey(null); setDragOverKey(null) }

  // ── Helpers ────────────────────────────────────────────────────────
  const { clearTaskParam } = useTaskFromQuery(tasks, setSelectedTask, () => setSelectedTask(null))

  async function copyTaskLink(task) {
    const url = taskShareUrl(task, activeList)
    try { await navigator.clipboard.writeText(url) }
    catch { window.prompt('Link da tarefa:', url) }
  }
  function closeTask() { setSelectedTask(null); clearTaskParam() }

  function getStatus(statusId) { return statuses.find(s => s.id === statusId) }
  const doneStatusId = statuses.find(s => /^conclu/i.test(s.name))?.id

  // ── Sort ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...filteredTasks].sort((a, b) => {
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
  }), [filteredTasks, sortBy])

  // ── Groups ─────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (groupBy === 'status') {
      return statuses.map(s => ({
        key: `status:${s.id}`,
        header: { dot: s.color, label: s.name },
        items: sorted.filter(t => t.status_id === s.id),
      }))
    }
    if (groupBy === 'assignee') {
      // Coleta IDs de assignees presentes nos tasks visíveis
      const seenIds = new Set()
      for (const t of sorted) {
        for (const a of (t.task_assignees ?? [])) seenIds.add(a.user_id)
      }
      const groupsArr = []
      // Membros do espaço primeiro (ordem dos membros)
      for (const m of members) {
        if (!seenIds.has(m.user_id)) continue
        const items = sorted.filter(t =>
          (t.task_assignees ?? []).some(a => a.user_id === m.user_id)
        )
        groupsArr.push({
          key: `assignee:${m.user_id}`,
          header: {
            avatar: m.profiles?.avatar_url
              ? <img src={m.profiles.avatar_url} alt="" className={styles.groupAvatar} />
              : <span className={styles.groupAvatar}>{getInitials(m.profiles?.name)}</span>,
            label: m.profiles?.name ?? '?',
          },
          items,
        })
      }
      // Sem responsável (tarefas sem nenhum assignee)
      const unassigned = sorted.filter(t => !t.task_assignees || t.task_assignees.length === 0)
      if (unassigned.length > 0) {
        groupsArr.push({
          key: 'assignee:none',
          header: { dot: 'var(--color-text-tertiary)', label: 'Sem responsável' },
          items: unassigned,
        })
      }
      return groupsArr
    }
    return [{ key: null, header: null, items: sorted }]
  }, [groupBy, statuses, members, sorted])

  // ── Column definitions ─────────────────────────────────────────────
  const allColumns = useMemo(() => {
    const map = {
      status: {
        key: 'status', header: 'Status',
        cell: (task) => {
          const s = getStatus(task.status_id)
          return s ? (
            <span className={styles.statusPill} style={{ background: s.color + '22', color: s.color }}>
              {s.name}
            </span>
          ) : null
        },
      },
      assignee: {
        key: 'assignee', header: 'Responsável',
        cell: (task) => (
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
        ),
      },
      due_date: {
        key: 'due_date', header: 'Prazo',
        cell: (task) => (
          task.due_date ? (
            <span className={`${styles.dueDate} ${
              isPast(new Date(task.due_date)) && task.status_id !== doneStatusId
                ? styles.overdue
                : isToday(new Date(task.due_date))
                ? styles.today
                : ''
            }`}>
              {format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}
            </span>
          ) : <span className={styles.none}>—</span>
        ),
      },
      priority: {
        key: 'priority', header: 'Prioridade',
        cell: (task) => (
          <span className={styles[PRIORITY_CLASS[task.priority]]}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        ),
      },
      last_comment: {
        key: 'last_comment', header: 'Últimos comentários',
        cell: (task) => {
          const all = task.comments ?? []
          if (all.length === 0) return <span className={styles.none}>—</span>
          const last = [...all].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
          const author = last.profiles?.name?.split(' ')?.[0] ?? '?'
          return (
            <div className={styles.commentPreview} title={`${last.profiles?.name ?? '?'}: ${last.content}`}>
              <span className={styles.commentAuthor}>{author}:</span>
              <span className={styles.commentText}>{last.content}</span>
              <span className={styles.commentTime}>{formatDistanceToNow(new Date(last.created_at), { addSuffix: false, locale: ptBR })}</span>
            </div>
          )
        },
      },
      attachments: {
        key: 'attachments', header: 'Anexos',
        cell: (task) => {
          const n = task.task_attachments?.length ?? 0
          if (n === 0) return <span className={styles.none}>—</span>
          return (
            <span className={styles.attachBadge} title={`${n} anexo${n > 1 ? 's' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              {n}
            </span>
          )
        },
      },
    }
    customFields.forEach(f => {
      map[`cf:${f.id}`] = {
        key: `cf:${f.id}`,
        header: f.name,
        cell: (task) => {
          const fv = (task.task_field_values ?? []).find(v => v.field_id === f.id)
          return <CustomFieldDisplay field={f} value={fv?.value} />
        },
      }
    })
    return map
  }, [customFields, statuses, doneStatusId])

  const orderedColumns = useMemo(
    () => columnOrder
      .filter(k => !hiddenColumns.has(k))
      .map(k => allColumns[k])
      .filter(Boolean),
    [columnOrder, allColumns, hiddenColumns]
  )

  if (!activeList) return null
  if (loading) return <div className={styles.loading}>Carregando...</div>

  // ── Render ─────────────────────────────────────────────────────────
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
              <option value="assignee">Responsável</option>
            </select>
            <span className={styles.sortLabel}>Ordenar</span>
            <select className={styles.sortSelect} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="position">Padrão</option>
              <option value="priority">Prioridade</option>
              <option value="due_date">Prazo</option>
            </select>
            {tasksWithDescription.length > 0 && (
              <button
                type="button"
                className={styles.gearBtn}
                onClick={toggleAllDescriptions}
                title={allExpanded ? 'Ocultar descrições' : 'Mostrar descrições'}
                aria-label={allExpanded ? 'Ocultar descrições' : 'Mostrar descrições'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <span>{allExpanded ? 'Ocultar descrição' : 'Mostrar descrição'}</span>
              </button>
            )}
            <button
              type="button"
              className={styles.gearBtn}
              onClick={() => setShowPanel(true)}
              title="Gerenciar colunas"
              aria-label="Gerenciar colunas"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="15" y2="12"/>
                <line x1="3" y1="18" x2="18" y2="18"/>
              </svg>
              <span>Colunas</span>
            </button>
          </div>
        </div>

        {groups.map(group => {
          const isCollapsed = group.key && collapsedGroups.has(group.key)
          return (
            <div key={group.key ?? 'all'} className={styles.group}>
              {group.header && (
                <button
                  type="button"
                  className={styles.groupHeader}
                  onClick={() => toggleGroup(group.key)}
                >
                  <Chevron open={!isCollapsed} />
                  {group.header.dot && (
                    <span className={styles.groupDot} style={{ background: group.header.dot }} />
                  )}
                  {group.header.avatar}
                  <span className={styles.groupName}>{group.header.label}</span>
                  <span className={styles.groupCount}>{group.items.length}</span>
                </button>
              )}
              {!isCollapsed && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thTitle}>Tarefa</th>
                      {orderedColumns.map(col => (
                        <th
                          key={col.key}
                          className={`${styles.th} ${styles.thDraggable} ${dragOverKey === col.key ? styles.thDragOver : ''} ${draggedKey === col.key ? styles.thDragging : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.key)}
                          onDragOver={(e) => handleDragOver(e, col.key)}
                          onDragEnter={(e) => handleDragOver(e, col.key)}
                          onDragLeave={() => setDragOverKey(k => k === col.key ? null : k)}
                          onDrop={(e) => handleDrop(e, col.key)}
                          onDragEnd={reset}
                          title="Arraste para reordenar"
                        >
                          <span className={styles.thInner}>
                            <span className={styles.grip}><GripIcon /></span>
                            {col.header}
                          </span>
                        </th>
                      ))}
                      <th className={styles.thActions} aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(task => {
                      const isDone = doneStatusId && task.status_id === doneStatusId
                      const hasDesc = (task.description ?? '').trim().length > 0
                      const isExpanded = hasDesc && expandedDesc.has(task.id)
                      return (
                        <Fragment key={task.id}>
                          <tr
                            className={`${styles.row} ${isDone ? styles.rowDone : ''} ${isExpanded ? styles.rowExpanded : ''}`}
                            onClick={() => setSelectedTask(task)}
                            tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && setSelectedTask(task)}
                          >
                            <td className={styles.tdTitle}>
                              <span className={styles.titleWrap}>
                                {hasDesc ? (
                                  <button
                                    type="button"
                                    className={styles.descToggle}
                                    onClick={e => toggleDescription(task.id, e)}
                                    title={isExpanded ? 'Ocultar descrição' : 'Mostrar descrição'}
                                    aria-label={isExpanded ? 'Ocultar descrição' : 'Mostrar descrição'}
                                  >
                                    <Chevron open={isExpanded} />
                                  </button>
                                ) : (
                                  <span className={styles.descToggleSpacer} aria-hidden="true" />
                                )}
                                <span className={styles.titleText}>{task.title}</span>
                              </span>
                            </td>
                            {orderedColumns.map(col => (
                              <td key={col.key} className={styles.td}>
                                {col.cell(task)}
                              </td>
                            ))}
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
                          {isExpanded && (
                            <tr
                              className={styles.descRow}
                              onClick={() => setSelectedTask(task)}
                            >
                              <td colSpan={orderedColumns.length + 2} className={styles.descCell}>
                                <div className={styles.descBody}>{task.description}</div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    {group.items.length === 0 && (
                      <tr>
                        <td colSpan={orderedColumns.length + 2} className={styles.emptyRow}>
                          Sem tarefas neste grupo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}

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

      {showPanel && (
        <ColumnsPanel
          listId={activeList.id}
          hiddenKeys={hiddenColumns}
          onToggleVisibility={toggleColumnVisibility}
          customFields={customFields}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  )
}
