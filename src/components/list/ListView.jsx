import { Fragment, useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../hooks/useAuth'
import { useCustomFields } from '../../hooks/useCustomFields'
import { useSpaceMembers } from '../../hooks/useSpaceMembers'
import { useSpaceTaskTypes } from '../../hooks/useSpaceTaskTypes'
import { useTaskFilters, applyFilters } from '../../hooks/useTaskFilters'
import { useTaskFromQuery, taskShareUrl } from '../../hooks/useTaskFromQuery'
import CustomFieldDisplay from '../task/CustomFieldDisplay'
import StatusTypePopover from '../task/StatusTypePopover'
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
const LIST_DESC_HIDDEN_KEY = (listId) => `gp.list_desc_hidden.${listId}`
const SHOW_ARCHIVED_KEY = (listId) => `gp.show_archived.${listId}`

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

const RowGripIcon = () => (
  <svg width="12" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
  </svg>
)

const RowCheckIcon = ({ done }) => (
  done ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3.5"/>
      <polyline points="8 12 11 15 16 9" stroke="var(--color-surface)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>
    </svg>
  )
)

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)

function getInitials(n) {
  return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

export default function ListView() {
  const { activeList, activeSpace, updateList } = useApp()
  const { user } = useAuth()
  const { statuses, tasks, loading, toggleDone, duplicateTask, softDeleteTask, addSubtask, updateTask } = useTasks(activeList?.id)
  const { fields: customFields } = useCustomFields(activeList?.id)
  const { members } = useSpaceMembers(activeSpace?.id)
  const { types: taskTypes } = useSpaceTaskTypes(activeSpace?.id)
  const { filters } = useTaskFilters()
  const [showArchived, setShowArchivedState] = useState(false)
  useEffect(() => {
    if (!activeList?.id) return
    try {
      const v = localStorage.getItem(SHOW_ARCHIVED_KEY(activeList.id))
      setShowArchivedState(v === '1')
    } catch { setShowArchivedState(false) }
  }, [activeList?.id])
  function toggleShowArchived() {
    setShowArchivedState(prev => {
      const next = !prev
      try { localStorage.setItem(SHOW_ARCHIVED_KEY(activeList.id), next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  // Filtra tarefas com status closed quando showArchived = false
  const closedStatusIds = useMemo(
    () => new Set(statuses.filter(s => (s.category ?? 'open') === 'closed').map(s => s.id)),
    [statuses]
  )
  const visibleByCategory = useMemo(
    () => showArchived ? tasks : tasks.filter(t => !closedStatusIds.has(t.status_id)),
    [tasks, closedStatusIds, showArchived]
  )
  const filteredTasks = useMemo(
    () => applyFilters(visibleByCategory, statuses, filters, user?.id),
    [visibleByCategory, statuses, filters, user?.id]
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
  // Chave estável pra usar como dep do useEffect abaixo. Só muda quando
  // os IDs de custom fields realmente mudam (não a cada render).
  const customFieldIdsKey = useMemo(
    () => customFields.map(f => f.id).join(','),
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
  }, [activeList?.id, customFieldIdsKey])

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

  // ── Popover Status / Tipo ──────────────────────────────────────────
  const [statusPopover, setStatusPopover] = useState(null) // { taskId, rect }
  function openStatusPopover(taskId, e) {
    if (e) { e.stopPropagation(); e.preventDefault() }
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    setStatusPopover({ taskId, rect })
  }
  function closeStatusPopover() { setStatusPopover(null) }
  async function pickStatusForTask(statusId) {
    if (!statusPopover?.taskId) return
    await updateTask(statusPopover.taskId, { status_id: statusId })
  }
  async function pickTypeForTask(typeId) {
    if (!statusPopover?.taskId) return
    await updateTask(statusPopover.taskId, { type_id: typeId })
  }

  // ── Inline subtask creation ────────────────────────────────────────
  const [addingSubtaskFor, setAddingSubtaskFor] = useState(null) // taskId
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [savingSubtask, setSavingSubtask] = useState(false)

  function openInlineSubtask(taskId, e) {
    if (e) e.stopPropagation()
    setAddingSubtaskFor(taskId)
    setNewSubtaskTitle('')
  }
  function cancelInlineSubtask(e) {
    if (e) { e.preventDefault(); e.stopPropagation() }
    setAddingSubtaskFor(null)
    setNewSubtaskTitle('')
  }
  async function saveInlineSubtask(e) {
    if (e) { e.preventDefault(); e.stopPropagation() }
    const title = newSubtaskTitle.trim()
    if (!title || !addingSubtaskFor) return
    setSavingSubtask(true)
    const { error } = await addSubtask(addingSubtaskFor, title)
    setSavingSubtask(false)
    if (!error) {
      // Garante que a tarefa fica expandida para mostrar a nova subtarefa quando o usuário ver o modal
      setAddingSubtaskFor(null)
      setNewSubtaskTitle('')
    }
  }

  // ── Descrição da Lista (card no topo) ──────────────────────────────
  const [listDescHidden, setListDescHidden] = useState(false)
  const [editingListDesc, setEditingListDesc] = useState(false)
  const [draftListDesc, setDraftListDesc] = useState('')
  const [savingListDesc, setSavingListDesc] = useState(false)

  useEffect(() => {
    if (!activeList?.id) return
    try {
      const raw = localStorage.getItem(LIST_DESC_HIDDEN_KEY(activeList.id))
      setListDescHidden(raw === '1')
    } catch { setListDescHidden(false) }
    setEditingListDesc(false)
    setDraftListDesc(activeList?.description ?? '')
  }, [activeList?.id, activeList?.description])

  // Sincroniza visibilidade com mudanças disparadas pelo topbar
  useEffect(() => {
    function onStorage(e) {
      if (!activeList?.id) return
      if (e.key !== LIST_DESC_HIDDEN_KEY(activeList.id)) return
      setListDescHidden(e.newValue === '1')
    }
    function onEdit(e) {
      if (!activeList?.id) return
      if (e.detail?.listId !== activeList.id) return
      setDraftListDesc(activeList?.description ?? '')
      setEditingListDesc(true)
      setListDescHidden(false)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('gp:list_desc_edit', onEdit)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('gp:list_desc_edit', onEdit)
    }
  }, [activeList?.id, activeList?.description])

  function toggleListDesc() {
    setListDescHidden(prev => {
      const next = !prev
      try { localStorage.setItem(LIST_DESC_HIDDEN_KEY(activeList.id), next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  function startEditListDesc() {
    setDraftListDesc(activeList?.description ?? '')
    setEditingListDesc(true)
    setListDescHidden(false)
    try { localStorage.setItem(LIST_DESC_HIDDEN_KEY(activeList.id), '0') } catch { /* ignore */ }
  }

  function cancelEditListDesc() {
    setEditingListDesc(false)
    setDraftListDesc(activeList?.description ?? '')
  }

  async function saveListDesc() {
    const next = draftListDesc.trim()
    setSavingListDesc(true)
    const value = next.length === 0 ? null : next
    await updateList(activeList.id, { description: value })
    setSavingListDesc(false)
    setEditingListDesc(false)
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
      const visibleStatuses = showArchived
        ? statuses
        : statuses.filter(s => (s.category ?? 'open') === 'open')
      return visibleStatuses.map(s => ({
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

  // Lista sem status: oferece criar a partir dos do espaço
  if (statuses.length === 0) {
    return <NoStatusEmpty listId={activeList.id} />
  }

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
            {closedStatusIds.size > 0 && (
              <button
                type="button"
                className={`${styles.gearBtn} ${showArchived ? styles.gearBtnActive : ''}`}
                onClick={toggleShowArchived}
                title={showArchived ? 'Ocultar tarefas arquivadas' : 'Mostrar tarefas arquivadas'}
                aria-label={showArchived ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}
                aria-pressed={showArchived}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <polyline points="21 8 21 21 3 21 3 8"/>
                  <rect x="1" y="3" width="22" height="5"/>
                  <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <span>{showArchived ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}</span>
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

        {/* Descrição da Lista — card no topo, antes dos grupos */}
        {(editingListDesc || (activeList?.description && !listDescHidden)) && (
          <div className={styles.listDescCard}>
            {editingListDesc ? (
              <>
                <textarea
                  className={styles.listDescTextarea}
                  value={draftListDesc}
                  onChange={e => setDraftListDesc(e.target.value)}
                  placeholder="Descreva o objetivo desta lista, contexto do projeto, links importantes..."
                  rows={5}
                  autoFocus
                  disabled={savingListDesc}
                  onKeyDown={e => {
                    if (e.key === 'Escape') cancelEditListDesc()
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveListDesc()
                  }}
                />
                <div className={styles.listDescActions}>
                  <span className={styles.listDescHint}>Ctrl+Enter pra salvar · Esc pra cancelar</span>
                  <div className={styles.listDescButtons}>
                    <button
                      type="button"
                      className={styles.listDescBtnCancel}
                      onClick={cancelEditListDesc}
                      disabled={savingListDesc}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.listDescBtnSave}
                      onClick={saveListDesc}
                      disabled={savingListDesc}
                    >
                      {savingListDesc ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.listDescView} onClick={startEditListDesc} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') startEditListDesc() }}
                title="Clique para editar"
              >
                <div className={styles.listDescContent}>{activeList.description}</div>
              </div>
            )}
          </div>
        )}

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
                      <th className={styles.thTitle}>Nome</th>
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
                                <span
                                  className={styles.rowGrip}
                                  title="Arrastar"
                                  aria-label="Arrastar"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <RowGripIcon />
                                </span>
                                <button
                                  type="button"
                                  className={`${styles.rowCheck} ${isDone ? styles.rowCheckDone : ''}`}
                                  onClick={e => { e.stopPropagation(); toggleDone(task.id) }}
                                  title={isDone ? 'Reabrir' : 'Concluir'}
                                  aria-label={isDone ? 'Reabrir' : 'Concluir'}
                                >
                                  <RowCheckIcon done={isDone} />
                                </button>
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
                                {(() => {
                                  const s = getStatus(task.status_id)
                                  return s ? (
                                    <button
                                      type="button"
                                      className={styles.titleStatusBtn}
                                      style={{ background: s.color }}
                                      title={`Status: ${s.name} · clique pra alterar`}
                                      aria-label={`Status: ${s.name}`}
                                      onClick={e => openStatusPopover(task.id, e)}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className={`${styles.titleStatusBtn} ${styles.titleStatusBtnEmpty}`}
                                      title="Definir status"
                                      aria-label="Definir status"
                                      onClick={e => openStatusPopover(task.id, e)}
                                    />
                                  )
                                })()}
                                <span className={styles.titleText}>{task.title}</span>
                                <span className={styles.titleActions} onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className={styles.titleBtn}
                                    onClick={e => openInlineSubtask(task.id, e)}
                                    title="Adicionar subtarefa"
                                    aria-label="Adicionar subtarefa"
                                  >
                                    <PlusIcon />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.titleBtn}
                                    onClick={e => { e.stopPropagation(); setSelectedTask(task) }}
                                    title="Abrir"
                                    aria-label="Abrir"
                                  >
                                    <PencilIcon />
                                  </button>
                                </span>
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
                          {addingSubtaskFor === task.id && (
                            <tr
                              className={styles.subtaskFormRow}
                              onClick={e => e.stopPropagation()}
                            >
                              <td colSpan={orderedColumns.length + 2} className={styles.subtaskFormCell}>
                                <form className={styles.subtaskForm} onSubmit={saveInlineSubtask}>
                                  <span className={styles.subtaskFormBullet} aria-hidden="true" />
                                  <input
                                    autoFocus
                                    type="text"
                                    className={styles.subtaskFormInput}
                                    value={newSubtaskTitle}
                                    onChange={e => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') cancelInlineSubtask(e) }}
                                    placeholder="Nome da subtarefa"
                                    disabled={savingSubtask}
                                  />
                                  <button
                                    type="button"
                                    className={styles.subtaskFormCancel}
                                    onClick={cancelInlineSubtask}
                                    disabled={savingSubtask}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="submit"
                                    className={styles.subtaskFormSave}
                                    disabled={savingSubtask || !newSubtaskTitle.trim()}
                                  >
                                    {savingSubtask ? 'Salvando...' : 'Salvar'}
                                  </button>
                                </form>
                              </td>
                            </tr>
                          )}
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

      {statusPopover && (() => {
        const t = tasks.find(x => x.id === statusPopover.taskId)
        return (
          <StatusTypePopover
            anchorRect={statusPopover.rect}
            statuses={statuses}
            types={taskTypes}
            currentStatusId={t?.status_id}
            currentTypeId={t?.type_id}
            onPickStatus={pickStatusForTask}
            onPickType={pickTypeForTask}
            onClose={closeStatusPopover}
          />
        )
      })()}
    </>
  )
}

function NoStatusEmpty({ listId }) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function handleFix() {
    setError('')
    setWorking(true)
    // RPC respeita permissão (security definer + can_edit_list)
    const { data, error: rpcErr } = await supabase.rpc('ensure_list_statuses', { p_list_id: listId })
    if (rpcErr) {
      setError(`Falha ao criar status: ${rpcErr.message}. Pode ser que a função do banco ainda não esteja atualizada — peça pro admin rodar supabase_schema_v14.sql.`)
      setWorking(false)
      return
    }
    // RPC retorna número de status criados. Se for 0, talvez o espaço esteja sem status também.
    if (data === 0) {
      setError('Nenhum status criado. Verifique se o espaço tem status configurados em Configurações do espaço → Status.')
      setWorking(false)
      return
    }
    // Recarrega pra refletir
    window.location.reload()
  }

  return (
    <div style={{
      padding: 60,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--color-surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>
        Esta lista não tem status configurados
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', maxWidth: 480, lineHeight: 1.5 }}>
        Sem status, não é possível criar tarefas. Clique no botão abaixo pra copiar
        os status do espaço — o mesmo conjunto que outras listas novas usam.
      </p>
      {error && (
        <p style={{
          fontSize: 12,
          color: 'var(--color-danger)',
          background: 'var(--color-danger-light)',
          padding: '8px 12px',
          borderRadius: 6,
          maxWidth: 480,
        }}>{error}</p>
      )}
      <button
        type="button"
        onClick={handleFix}
        disabled={working}
        style={{
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 500,
          color: '#fff',
          background: 'var(--color-accent)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {working ? 'Criando...' : 'Criar status padrão'}
      </button>
    </div>
  )
}
