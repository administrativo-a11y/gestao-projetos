import { useState } from 'react'
import Sidebar from '../components/shared/Sidebar'
import UndoToast from '../components/shared/UndoToast'
import BoardView from '../components/board/BoardView'
import { useApp } from '../hooks/useApp'
import styles from './App.module.css'

export default function AppPage() {
  const { activeList, activeSpace } = useApp()
  const [activeView, setActiveView] = useState('board')

  return (
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.main}>
        {activeList ? (
          <>
            <header className={styles.topbar}>
              <div className={styles.topbarLeft}>
                <span className={styles.listName}>{activeList.name}</span>
              </div>
              <nav className={styles.tabs}>
                {[
                  { id: 'board', label: 'Board' },
                  { id: 'list', label: 'Lista' },
                ].map(v => (
                  <button
                    key={v.id}
                    className={`${styles.tab} ${activeView === v.id ? styles.tabActive : ''}`}
                    onClick={() => setActiveView(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </nav>
            </header>
            <div className={styles.content}>
              <BoardView />
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyInner}>
              <div className={styles.emptyDot} />
              <h2 className={styles.emptyTitle}>
                {activeSpace ? 'Selecione uma lista' : 'Selecione um espaço'}
              </h2>
              <p className={styles.emptyText}>
                {activeSpace
                  ? 'Escolha uma lista na sidebar para ver as tarefas.'
                  : 'Clique no dropdown no topo da sidebar para selecionar ou criar um espaço.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <UndoToast />
    </div>
  )
}
