import ContextMenu from '../shared/ContextMenu'
import styles from './TaskQuickActions.module.css'

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

/**
 * Botões de ações rápidas para um card/linha de tarefa.
 *
 * Para integrar como overlay hover, o pai deve ter um `:hover .container { opacity: 1 }`
 * e definir a classe `.container` como ponto de hook (essa lógica fica no caller, não aqui).
 *
 * Props:
 *  - task: tarefa
 *  - isDone: bool
 *  - onToggleDone, onDuplicate, onCopyLink, onDelete: handlers
 *  - variant: 'inline' | 'overlay' (overlay = borda + sombra como o card do Board)
 */
export default function TaskQuickActions({
  task, isDone,
  onToggleDone, onDuplicate, onCopyLink, onDelete,
  variant = 'inline',
}) {
  return (
    <div
      className={`${styles.bar} ${variant === 'overlay' ? styles.overlay : styles.inline}`}
      onClick={e => e.stopPropagation()}
    >
      <button
        className={`${styles.btn} ${isDone ? styles.btnDone : ''}`}
        onClick={() => onToggleDone?.(task)}
        title={isDone ? 'Reabrir' : 'Concluir'}
        aria-label={isDone ? 'Reabrir' : 'Concluir'}
      >
        <CheckIcon filled={isDone} />
      </button>
      <button
        className={styles.btn}
        onClick={() => onDuplicate?.(task)}
        title="Duplicar"
        aria-label="Duplicar"
      >
        <CopyIcon />
      </button>
      <ContextMenu
        trigger={
          <button className={styles.btn} title="Mais" aria-label="Mais ações">
            <DotsIcon />
          </button>
        }
        items={[
          { label: 'Copiar link', icon: <LinkIcon />, onClick: () => onCopyLink?.(task) },
          { label: 'Duplicar', icon: <CopyIcon />, onClick: () => onDuplicate?.(task) },
          { separator: true },
          { label: 'Excluir', icon: <TrashIcon />, danger: true, onClick: () => onDelete?.(task) },
        ]}
      />
    </div>
  )
}
