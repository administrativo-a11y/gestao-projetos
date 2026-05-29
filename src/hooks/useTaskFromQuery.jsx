import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Lê `?task=<id>` da URL e chama `onOpen(task)` quando encontra a tarefa
 * na lista atual. Quando a query param desaparece, chama `onClose()`.
 * Também expõe `clearTaskParam()` pra remover só esse parâmetro.
 */
export function useTaskFromQuery(tasks, onOpen, onClose) {
  const [searchParams, setSearchParams] = useSearchParams()
  const taskId = searchParams.get('task')

  useEffect(() => {
    if (!taskId) {
      onClose?.()
      return
    }
    if (!tasks || tasks.length === 0) return
    const task = tasks.find(t => t.id === taskId)
    if (task) onOpen?.(task)
    // se não acha, deixa quieto — pode ainda estar carregando ou não tem acesso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, tasks])

  function clearTaskParam() {
    if (!taskId) return
    const next = new URLSearchParams(searchParams)
    next.delete('task')
    setSearchParams(next, { replace: true })
  }

  return { taskId, clearTaskParam }
}

/**
 * Gera o link compartilhável de uma tarefa (com `?task=ID`).
 */
export function taskShareUrl(task, list) {
  if (!list) return ''
  const base = window.location.origin
  return `${base}/space/${list.space_id}/list/${list.id}?task=${task.id}`
}
