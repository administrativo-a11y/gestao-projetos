import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import UndoToast from '../components/shared/UndoToast'
import BoardView from '../components/board/BoardView'
import ListView from '../components/list/ListView'
import DashboardView from '../components/dashboard/DashboardView'
import { useApp } from '../hooks/useApp'
import styles from './App.module.css'

const VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'Lista' },
  { id: 'dashboard', label: 'Painel' },
]

export default function AppPage() {
  const { spaceId, listId } = useParams()
  const navigate = useNavigate()
  const {
    spaces, lists, activeList, activeSpace,
    setActiveSpace, selectList,
  } = useApp()
  const [activeView, setActiveView] = useState('board')

  // URL → state (quando spaces/lists chegam ou URL muda)
  useEffect(() => {
    if (!spaceId) return
    if (spaces.length === 0) return
    if (activeSpace?.id === spaceId) return
    const sp = spaces.find(s => s.id === spaceId)
    if (sp) setActiveSpace(sp)
  }, [spaceId, spaces, activeSpace?.id, setActiveSpace])

  useEffect(() => {
    if (!listId) return
    if (lists.length === 0) return
    if (activeList?.id === listId) return
    const li = lists.find(l => l.id === listId)
    if (li) selectList(li)
  }, [listId, lists, activeList?.id, selectList])

  // state → URL (sidebar chama navigate diretamente; aqui só normalizamos
  // quando a lista ativa muda mas a URL ainda não, ex. depois de excluir)
  useEffect(() => {
    if (!activeSpace) {
      if (spaceId) navigate('/', { replace: true })
      return
    }
    const want = activeList
      ? `/space/${activeSpace.id}/list/${activeList.id}`
      : `/space/${activeSpace.id}`
    if (window.location.pathname !== want) {
      navigate(want, { replace: true })
    }
  }, [activeSpace, activeList])

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
                {VIEWS.map(v => (
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
              {activeView === 'board' && <BoardView />}
              {activeView === 'list' && <ListView />}
              {activeView === 'dashboard' && <DashboardView />}
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
