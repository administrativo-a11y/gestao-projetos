import { useApp } from '../../hooks/useApp'
import styles from './UndoToast.module.css'

export default function UndoToast() {
  const { undoToast, handleUndo } = useApp()
  if (!undoToast) return null

  return (
    <div className={styles.toast} role="alert">
      <span className={styles.message}>{undoToast.message}</span>
      <button className={styles.undoBtn} onClick={handleUndo}>Desfazer</button>
    </div>
  )
}
