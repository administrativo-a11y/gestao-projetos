import { useState, useMemo, useRef } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import { useAuth } from '../../hooks/useAuth'
import { useTaskFilters, applyFilters } from '../../hooks/useTaskFilters'
import { useListDependencies } from '../../hooks/useTaskDependencies'
import TaskDetailModal from '../board/TaskDetailModal'
import { addDays, addMonths, differenceInDays, eachDayOfInterval, format, isWeekend, startOfWeek, startOfMonth, startOfDay, max as dateMax, min as dateMin } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import styles from './GanttView.module.css'

const ZOOM = {
  day:   { dayWidth: 40,  label: 'Dia',    headerFmt: 'dd MMM', tickEvery: 1 },
  week:  { dayWidth: 18,  label: 'Semana', headerFmt: 'dd MMM', tickEvery: 7 },
  month: { dayWidth: 6,   label: 'Mês',    headerFmt: 'MMM yy', tickEvery: 30 },
}

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 40
const SIDE_WIDTH = 220

export default function GanttView() {
  const { activeList } = useApp()
  const { user } = useAuth()
  const { tasks: allTasks, statuses, loading } = useTasks(activeList?.id)
  const { filters } = useTaskFilters()
  const tasks = useMemo(
    () => applyFilters(allTasks, statuses, filters, user?.id),
    [allTasks, statuses, filters, user?.id]
  )
  const { deps } = useListDependencies(activeList?.id)
  const [zoom, setZoom] = useState('week')
  const [selectedTask, setSelectedTask] = useState(null)

  // Determina intervalo: do menor start/due ao maior, com padding
  const interval = useMemo(() => {
    const dated = tasks.filter(t => t.due_date || t.start_date)
    if (dated.length === 0) {
      const today = startOfDay(new Date())
      return { from: addDays(today, -7), to: addDays(today, 30) }
    }
    let minD = null
    let maxD = null
    for (const t of dated) {
      const s = t.start_date ? new Date(t.start_date) : null
      const e = t.due_date ? new Date(t.due_date) : null
      const candidates = [s, e].filter(Boolean)
      for (const d of candidates) {
        if (!minD || d < minD) minD = d
        if (!maxD || d > maxD) maxD = d
      }
    }
    return {
      from: addDays(minD, -3),
      to: addDays(maxD, 7),
    }
  }, [tasks])

  const days = useMemo(
    () => eachDayOfInterval({ start: interval.from, end: interval.to }),
    [interval.from, interval.to]
  )

  const { dayWidth, headerFmt, tickEvery } = ZOOM[zoom]
  const totalWidth = days.length * dayWidth

  // Header ticks
  const headerTicks = useMemo(() => {
    if (zoom === 'day') {
      return days.map((d, i) => ({ day: d, x: i * dayWidth, weekend: isWeekend(d) }))
    }
    if (zoom === 'week') {
      const ticks = []
      for (let i = 0; i < days.length; i++) {
        if (i === 0 || days[i].getDay() === 1) ticks.push({ day: days[i], x: i * dayWidth })
      }
      return ticks
    }
    // month
    const ticks = []
    for (let i = 0; i < days.length; i++) {
      if (i === 0 || days[i].getDate() === 1) ticks.push({ day: days[i], x: i * dayWidth })
    }
    return ticks
  }, [days, dayWidth, zoom])

  // Tarefas com data viram barras; sem data vão pra seção "Sem data"
  const dated = useMemo(() => tasks.filter(t => t.due_date), [tasks])
  const undated = useMemo(() => tasks.filter(t => !t.due_date), [tasks])

  function getStatus(t) {
    return statuses.find(s => s.id === t.status_id)
  }

  function barFor(task) {
    const due = new Date(task.due_date)
    const start = task.start_date ? new Date(task.start_date) : due
    const safeStart = dateMin([start, due])
    const safeEnd = dateMax([start, due])
    const offset = differenceInDays(safeStart, interval.from)
    const span = Math.max(1, differenceInDays(safeEnd, safeStart) + 1)
    return { x: offset * dayWidth, w: span * dayWidth }
  }

  const taskIndex = useMemo(() => {
    const map = new Map()
    dated.forEach((t, i) => map.set(t.id, i))
    return map
  }, [dated])

  // Linhas SVG de dependência: do final da pred ao início do succ
  const depLines = useMemo(() => {
    const lines = []
    for (const d of deps) {
      const predId = d.predecessor?.id
      const succId = d.successor?.id
      const predTask = dated.find(t => t.id === predId)
      const succTask = dated.find(t => t.id === succId)
      if (!predTask || !succTask) continue
      const predBar = barFor(predTask)
      const succBar = barFor(succTask)
      const predRow = taskIndex.get(predId)
      const succRow = taskIndex.get(succId)
      const y1 = predRow * ROW_HEIGHT + ROW_HEIGHT / 2
      const y2 = succRow * ROW_HEIGHT + ROW_HEIGHT / 2
      const x1 = predBar.x + predBar.w
      const x2 = succBar.x
      // path: do fim da pred, vai 8px pra direita, sobe/desce até y2, depois até x2-4, seta
      const midX = Math.max(x1 + 8, x2 - 8)
      const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
      lines.push({ id: d.id, path, x2, y2 })
    }
    return lines
  }, [deps, dated, taskIndex, interval.from, dayWidth])

  // Scroll horizontal sincronizado entre header e grid
  const headerScrollRef = useRef(null)
  const gridScrollRef = useRef(null)
  function onGridScroll(e) {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.target.scrollLeft
  }

  if (!activeList) return null
  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.toolbar}>
          <span className={styles.count}>{dated.length} tarefas com prazo</span>
          {undated.length > 0 && (
            <span className={styles.muted}>· {undated.length} sem data</span>
          )}
          <div className={styles.zoomGroup}>
            {Object.entries(ZOOM).map(([id, z]) => (
              <button
                key={id}
                className={`${styles.zoomBtn} ${zoom === id ? styles.zoomBtnActive : ''}`}
                onClick={() => setZoom(id)}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.viewport}>
          {/* Coluna fixa esquerda: nomes */}
          <div className={styles.sideCol} style={{ width: SIDE_WIDTH }}>
            <div className={styles.sideHeader} style={{ height: HEADER_HEIGHT }}>Tarefa</div>
            <div className={styles.sideBody}>
              {dated.map(t => {
                const st = getStatus(t)
                return (
                  <div key={t.id} className={styles.sideRow} style={{ height: ROW_HEIGHT }} onClick={() => setSelectedTask(t)}>
                    {st && <span className={styles.statusDot} style={{ background: st.color }} />}
                    <span className={styles.sideTitle}>{t.title}</span>
                  </div>
                )
              })}
              {undated.length > 0 && (
                <>
                  <div className={styles.sideSection}>Sem data</div>
                  {undated.map(t => (
                    <div key={t.id} className={styles.sideRow} style={{ height: ROW_HEIGHT }} onClick={() => setSelectedTask(t)}>
                      <span className={styles.sideTitle}>{t.title}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Direita: cabeçalho temporal + grade + barras */}
          <div className={styles.chart}>
            <div className={styles.headerScroll} ref={headerScrollRef}>
              <div className={styles.headerInner} style={{ width: totalWidth, height: HEADER_HEIGHT }}>
                {headerTicks.map((t, i) => (
                  <div key={i} className={styles.headerTick} style={{ left: t.x }}>
                    {format(t.day, headerFmt, { locale: ptBR })}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.gridScroll} ref={gridScrollRef} onScroll={onGridScroll}>
              <div className={styles.gridInner} style={{ width: totalWidth, height: dated.length * ROW_HEIGHT }}>
                {/* Linhas verticais */}
                {zoom === 'day' && days.map((d, i) => (
                  isWeekend(d) && (
                    <div key={i} className={styles.weekendCol} style={{ left: i * dayWidth, width: dayWidth }} />
                  )
                ))}
                {headerTicks.map((t, i) => (
                  <div key={`v${i}`} className={styles.vLine} style={{ left: t.x }} />
                ))}
                {/* Linhas horizontais */}
                {dated.map((_, i) => (
                  <div key={`h${i}`} className={styles.hLine} style={{ top: (i + 1) * ROW_HEIGHT }} />
                ))}

                {/* Barras */}
                {dated.map((task, i) => {
                  const { x, w } = barFor(task)
                  const st = getStatus(task)
                  const color = st?.color ?? 'var(--color-accent)'
                  return (
                    <div
                      key={task.id}
                      className={styles.bar}
                      style={{
                        left: x,
                        width: w,
                        top: i * ROW_HEIGHT + (ROW_HEIGHT - 22) / 2,
                        background: color + '33',
                        borderColor: color,
                      }}
                      onClick={() => setSelectedTask(task)}
                      title={`${task.title} — ${format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}`}
                    >
                      <span className={styles.barLabel} style={{ color }}>{task.title}</span>
                    </div>
                  )
                })}

                {/* Linhas SVG de dependências */}
                <svg
                  className={styles.depSvg}
                  width={totalWidth}
                  height={dated.length * ROW_HEIGHT}
                >
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-text-tertiary)" />
                    </marker>
                  </defs>
                  {depLines.map(l => (
                    <path
                      key={l.id}
                      d={l.path}
                      stroke="var(--color-text-tertiary)"
                      strokeWidth="1.5"
                      fill="none"
                      markerEnd="url(#arrow)"
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          statuses={statuses}
          listId={activeList.id}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  )
}
