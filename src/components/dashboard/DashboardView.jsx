import { useTasks } from '../../hooks/useTasks'
import { useProjects } from '../../hooks/useProjects'
import { isPast } from 'date-fns'
import styles from './DashboardView.module.css'

export default function DashboardView({ projectId }) {
  const { columns, tasks, loading } = useTasks(projectId)
  const { projects } = useProjects()
  const project = projects.find(p => p.id === projectId)

  if (loading) return <div className={styles.loading}>Carregando...</div>

  const total = tasks.length
  const done = tasks.filter(t => {
    const col = columns.find(c => c.id === t.column_id)
    return col?.name === 'Concluído'
  }).length
  const overdue = tasks.filter(t => {
    const col = columns.find(c => c.id === t.column_id)
    return t.due_date && isPast(new Date(t.due_date)) && col?.name !== 'Concluído'
  }).length
  const highPriority = tasks.filter(t => t.priority === 'high').length

  const soonest = tasks
    .filter(t => t.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]

  return (
    <div className={styles.wrapper}>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total de tarefas</span>
          <span className={styles.metricValue}>{total}</span>
          <span className={styles.metricSub}>neste projeto</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Concluídas</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-accent)' }}>{done}</span>
          <span className={styles.metricSub}>{total > 0 ? Math.round((done / total) * 100) : 0}% do total</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Atrasadas</span>
          <span className={styles.metricValue} style={{ color: overdue > 0 ? 'var(--color-priority-high)' : 'var(--color-text-tertiary)' }}>{overdue}</span>
          <span className={styles.metricSub}>{overdue > 0 ? 'requer atenção' : 'tudo em dia'}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Alta prioridade</span>
          <span className={styles.metricValue}>{highPriority}</span>
          <span className={styles.metricSub}>tarefas urgentes</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Distribuição por status</h3>
          <div className={styles.statusList}>
            {columns.map(col => {
              const count = tasks.filter(t => t.column_id === col.id).length
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={col.id} className={styles.statusItem}>
                  <div className={styles.statusHeader}>
                    <span className={styles.statusDot} style={{ background: col.color }} />
                    <span className={styles.statusName}>{col.name}</span>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${pct}%`, background: col.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Prioridades</h3>
          <div className={styles.priorityList}>
            {[
              { key: 'high', label: 'Alta', color: 'var(--color-priority-high)' },
              { key: 'medium', label: 'Média', color: 'var(--color-priority-medium)' },
              { key: 'low', label: 'Baixa', color: 'var(--color-priority-low)' },
            ].map(p => {
              const count = tasks.filter(t => t.priority === p.key).length
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={p.key} className={styles.statusItem}>
                  <div className={styles.statusHeader}>
                    <span className={styles.statusDot} style={{ background: p.color }} />
                    <span className={styles.statusName}>{p.label}</span>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Progresso geral</h3>
          <div className={styles.progressWrap}>
            <div className={styles.progressCircleLabel}>
              <span className={styles.progressPct}>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
              <span className={styles.progressSub}>concluído</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
            </div>
            <p className={styles.progressNote}>{done} de {total} tarefas concluídas</p>
          </div>
        </div>

        {soonest && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Próximo prazo</h3>
            <div className={styles.nextDeadline}>
              <span className={styles.deadlineTitle}>{soonest.title}</span>
              <span className={styles.deadlineDate}>{soonest.due_date}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
