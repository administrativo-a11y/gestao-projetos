import styles from './Topbar.module.css'

export default function Topbar({ projectName, projectColor, activeView, onViewChange }) {
  const views = [
    { id: 'board', label: 'Board', icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="12"/>
      </svg>
    )},
    { id: 'list', label: 'Lista', icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    )},
    { id: 'dashboard', label: 'Dashboard', icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <rect x="2" y="3" width="6" height="8"/><rect x="2" y="14" width="6" height="7"/><rect x="9" y="3" width="13" height="5"/>
        <rect x="9" y="11" width="13" height="10"/>
      </svg>
    )},
  ]

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <span className={styles.dot} style={{ background: projectColor }} />
        <h1 className={styles.title}>{projectName}</h1>
      </div>

      <nav className={styles.tabs} aria-label="Visualizações">
        {views.map(v => (
          <button
            key={v.id}
            className={`${styles.tab} ${activeView === v.id ? styles.active : ''}`}
            onClick={() => onViewChange(v.id)}
            aria-current={activeView === v.id ? 'page' : undefined}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
