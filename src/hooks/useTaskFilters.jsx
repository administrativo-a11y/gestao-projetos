import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isPast, isWithinInterval, parseISO } from 'date-fns'

// Schema do filtro:
// {
//   status_ids: string[],
//   priorities: ('high'|'medium'|'low')[],
//   assignee_ids: string[],   // ids dos users; 'none' significa "sem responsável"
//   due_from: string|null,    // yyyy-mm-dd
//   due_to: string|null,
//   only_overdue: boolean,
// }

export const EMPTY_FILTERS = {
  status_ids: [],
  priorities: [],
  assignee_ids: [],
  due_from: null,
  due_to: null,
  only_overdue: false,
}

function encodeFilters(f) {
  const sp = new URLSearchParams()
  if (f.status_ids?.length) sp.set('status', f.status_ids.join(','))
  if (f.priorities?.length) sp.set('priority', f.priorities.join(','))
  if (f.assignee_ids?.length) sp.set('assignee', f.assignee_ids.join(','))
  if (f.due_from) sp.set('from', f.due_from)
  if (f.due_to) sp.set('to', f.due_to)
  if (f.only_overdue) sp.set('overdue', '1')
  return sp
}

function decodeFilters(sp) {
  return {
    status_ids: sp.get('status')?.split(',').filter(Boolean) ?? [],
    priorities: sp.get('priority')?.split(',').filter(Boolean) ?? [],
    assignee_ids: sp.get('assignee')?.split(',').filter(Boolean) ?? [],
    due_from: sp.get('from') ?? null,
    due_to: sp.get('to') ?? null,
    only_overdue: sp.get('overdue') === '1',
  }
}

export function useTaskFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFiltersState] = useState(() => decodeFilters(searchParams))

  // Sincroniza URL → state quando navegação muda (ex: load de saved view)
  useEffect(() => {
    setFiltersState(decodeFilters(searchParams))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  const setFilters = useCallback((next) => {
    const merged = typeof next === 'function' ? next(filters) : next
    setFiltersState(merged)
    const sp = encodeFilters(merged)
    // preserva outros params que não sejam de filtro
    for (const k of ['status','priority','assignee','from','to','overdue']) {
      // nada — já reconstruímos do zero
    }
    setSearchParams(sp, { replace: true })
  }, [filters, setSearchParams])

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters])

  const isActive = (
    (filters.status_ids?.length ?? 0) +
    (filters.priorities?.length ?? 0) +
    (filters.assignee_ids?.length ?? 0)
  ) > 0 || !!filters.due_from || !!filters.due_to || filters.only_overdue

  return { filters, setFilters, clearFilters, isActive }
}

// Aplica filtros a uma lista de tarefas + statuses
export function applyFilters(tasks, statuses, filters, currentUserId) {
  if (!filters) return tasks
  const doneStatus = statuses.find(s => /conclu/i.test(s.name))
  return tasks.filter(t => {
    if (filters.status_ids?.length && !filters.status_ids.includes(t.status_id)) return false
    if (filters.priorities?.length && !filters.priorities.includes(t.priority)) return false

    if (filters.assignee_ids?.length) {
      const taskAssignees = (t.task_assignees ?? []).map(a => a.user_id)
      const wantsNone = filters.assignee_ids.includes('none')
      const wantsMe = filters.assignee_ids.includes('me')
      const wantsIds = filters.assignee_ids.filter(id => id !== 'none' && id !== 'me')

      const matchesNone = wantsNone && taskAssignees.length === 0
      const matchesMe = wantsMe && currentUserId && taskAssignees.includes(currentUserId)
      const matchesAny = wantsIds.some(id => taskAssignees.includes(id))

      if (!(matchesNone || matchesMe || matchesAny)) return false
    }

    if (filters.due_from || filters.due_to) {
      if (!t.due_date) return false
      const d = parseISO(t.due_date)
      const from = filters.due_from ? parseISO(filters.due_from) : new Date(-8640000000000000)
      const to = filters.due_to ? parseISO(filters.due_to) : new Date(8640000000000000)
      if (!isWithinInterval(d, { start: from, end: to })) return false
    }

    if (filters.only_overdue) {
      if (!t.due_date) return false
      if (!isPast(parseISO(t.due_date))) return false
      if (doneStatus && t.status_id === doneStatus.id) return false
    }

    return true
  })
}
