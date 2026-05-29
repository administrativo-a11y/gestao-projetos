import { useState } from 'react'
import CustomFieldsManager from './CustomFieldsManager'
import modalStyles from '../shared/Modal.module.css'
import styles from './ListSettingsModal.module.css'

export default function ListSettingsModal({ list, onClose }) {
  const [tab, setTab] = useState('fields')

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal} ${styles.modal}`} role="dialog">
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>
            <span style={{
              display: 'inline-block', width: 14, height: 14, borderRadius: 3,
              background: list.color, marginRight: 8, verticalAlign: 'middle',
            }} />
            {list.name}
          </h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          {[
            { id: 'fields', label: 'Campos personalizados' },
          ].map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === 'fields' && <CustomFieldsManager listId={list.id} />}
        </div>
      </div>
    </div>
  )
}
