import { useState } from 'react'
import { useTaskDependencies } from '../../hooks/useTaskDependencies'
import { useTasks } from '../../hooks/useTasks'
import { useApp } from '../../hooks/useApp'
import styles from './DependenciesTab.module.css'

function TaskRow({ task, status, onRemove }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        {status && (
          <span className={styles.statusDot} style={{ background: status.color }} title={status.name} />
        )}
        <span className={styles.taskTitle}>{task?.title ?? '?'}</span>
      </div>
      <button className={styles.removeBtn} onClick={onRemove} title="Remover dependência">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </li>
  )
}

function AddPicker({ candidates, onPick, onCancel }) {
  const [query, setQuery] = useState('')
  const filtered = candidates.filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className={styles.picker}>
      <input
        type="text"
        autoFocus
        placeholder="Buscar tarefa..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className={styles.pickerInput}
      />
      <div className={styles.pickerList}>
        {filtered.length === 0 && (
          <div className={styles.pickerEmpty}>Nenhuma tarefa encontrada</div>
        )}
        {filtered.map(t => (
          <button key={t.id} className={styles.pickerItem} onClick={() => onPick(t.id)}>
            {t.title}
          </button>
        ))}
      </div>
      <button className={styles.pickerCancel} onClick={onCancel}>Cancelar</button>
    </div>
  )
}

export default function DependenciesTab({ task }) {
  const { activeList } = useApp()
  const { tasks, statuses } = useTasks(activeList?.id)
  const {
    predecessors, successors, loading, error,
    addPredecessor, addSuccessor, removeDependency,
  } = useTaskDependencies(task.id)

  const [adding, setAdding] = useState(null) // 'pred' | 'succ' | null

  // Não pode ser ela mesma, nem já existente do mesmo lado
  const existingPredIds = predecessors.map(p => p.predecessor?.id)
  const existingSuccIds = successors.map(s => s.successor?.id)

  const predCandidates = tasks.filter(t =>
    t.id !== task.id && !existingPredIds.includes(t.id)
  )
  const succCandidates = tasks.filter(t =>
    t.id !== task.id && !existingSuccIds.includes(t.id)
  )

  function getStatus(statusId) {
    return statuses.find(s => s.id === statusId)
  }

  async function handleAddPred(taskId) {
    setAdding(null)
    const { error } = await addPredecessor(taskId)
    if (error) alert(error.message)
  }

  async function handleAddSucc(taskId) {
    setAdding(null)
    const { error } = await addSuccessor(taskId)
    if (error) alert(error.message)
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Predecessoras</h4>
          <span className={styles.hint}>devem terminar antes desta</span>
        </div>
        {loading ? (
          <div className={styles.empty}>Carregando...</div>
        ) : predecessors.length === 0 ? (
          <div className={styles.empty}>Nenhuma predecessora.</div>
        ) : (
          <ul className={styles.list}>
            {predecessors.map(p => (
              <TaskRow
                key={p.id}
                task={p.predecessor}
                status={getStatus(p.predecessor?.status_id)}
                onRemove={() => removeDependency(p.id)}
              />
            ))}
          </ul>
        )}
        {adding === 'pred' ? (
          <AddPicker
            candidates={predCandidates}
            onPick={handleAddPred}
            onCancel={() => setAdding(null)}
          />
        ) : (
          <button className={styles.addBtn} onClick={() => setAdding('pred')}>
            + Adicionar predecessora
          </button>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Sucessoras</h4>
          <span className={styles.hint}>esperam esta terminar</span>
        </div>
        {loading ? (
          <div className={styles.empty}>Carregando...</div>
        ) : successors.length === 0 ? (
          <div className={styles.empty}>Nenhuma sucessora.</div>
        ) : (
          <ul className={styles.list}>
            {successors.map(s => (
              <TaskRow
                key={s.id}
                task={s.successor}
                status={getStatus(s.successor?.status_id)}
                onRemove={() => removeDependency(s.id)}
              />
            ))}
          </ul>
        )}
        {adding === 'succ' ? (
          <AddPicker
            candidates={succCandidates}
            onPick={handleAddSucc}
            onCancel={() => setAdding(null)}
          />
        ) : (
          <button className={styles.addBtn} onClick={() => setAdding('succ')}>
            + Adicionar sucessora
          </button>
        )}
      </section>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
