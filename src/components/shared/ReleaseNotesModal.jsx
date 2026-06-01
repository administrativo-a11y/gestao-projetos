import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RELEASES } from '../../data/releases'
import modalStyles from './Modal.module.css'
import styles from './ReleaseNotesModal.module.css'

const TYPE_LABEL = {
  feat: 'Nova feature',
  fix: 'Correção',
  chore: 'Manutenção',
}

export default function ReleaseNotesModal({ onClose }) {
  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal} ${styles.modal}`} role="dialog" aria-label="Notas de versão">
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>O que mudou</h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {RELEASES.map((rel, i) => (
            <section key={rel.version} className={styles.release}>
              <header className={styles.releaseHeader}>
                <div className={styles.versionRow}>
                  <span className={styles.version}>v{rel.version}</span>
                  {i === 0 && <span className={styles.latest}>Atual</span>}
                </div>
                <span className={styles.date}>
                  {format(new Date(rel.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </header>

              {rel.title && <h3 className={styles.releaseTitle}>{rel.title}</h3>}

              <ul className={styles.items}>
                {rel.items.map((item, idx) => (
                  <li key={idx} className={styles.item}>
                    <span className={`${styles.tag} ${styles[`tag_${item.type}`]}`} title={TYPE_LABEL[item.type]}>
                      {item.type}
                    </span>
                    <span className={styles.itemText}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
