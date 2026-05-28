import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import { isPast } from 'date-fns'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import styles from './DashboardView.module.css'

export default function DashboardView() {
  const { activeList } = useApp()
  const { statuses, tasks, loading } = useTasks(activeList?.id)

  if (!activeList) return null
  if (loading) return <div className={styles.loading}>Carregando...</div>

  const total = tasks.length
  const doneStatus = statuses.find(s => /conclu/i.test(s.name))
  const done = doneStatus ? tasks.filter(t => t.status_id === doneStatus.id).length : 0
  const overdue = tasks.filter(t =>
    t.due_date && isPast(new Date(t.due_date)) && t.status_id !== doneStatus?.id
  ).length
  const highPriority = tasks.filter(t => t.priority === 'high').length

  const soonest = tasks
    .filter(t => t.due_date && t.status_id !== doneStatus?.id)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={styles.wrapper}>
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total de tarefas</span>
          <span className={styles.metricValue}>{total}</span>
          <span className={styles.metricSub}>nesta lista</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Concluídas</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-accent)' }}>{done}</span>
          <span className={styles.metricSub}>{pct}% do total</span>
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
            {statuses.map(status => {
              const count = tasks.filter(t => t.status_id === status.id).length
              const pctStatus = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={status.id} className={styles.statusItem}>
                  <div className={styles.statusHeader}>
                    <span className={styles.statusDot} style={{ background: status.color }} />
                    <span className={styles.statusName}>{status.name}</span>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${pctStatus}%`, background: status.color }} />
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
              const pctP = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={p.key} className={styles.statusItem}>
                  <div className={styles.statusHeader}>
                    <span className={styles.statusDot} style={{ background: p.color }} />
                    <span className={styles.statusName}>{p.label}</span>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${pctP}%`, background: p.color }} />
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
              <span className={styles.progressPct}>{pct}%</span>
              <span className={styles.progressSub}>concluído</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <p className={styles.progressNote}>{done} de {total} tarefas concluídas</p>
          </div>
        </div>

        {soonest && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Próximo prazo</h3>
            <div className={styles.nextDeadline}>
              <span className={styles.deadlineTitle}>{soonest.title}</span>
              <span className={styles.deadlineDate}>
                {format(new Date(soonest.due_date), "d 'de' MMM", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
