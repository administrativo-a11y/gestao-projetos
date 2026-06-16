import { useNavigate } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import styles from './NavRail.module.css'

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>
  </svg>
)
const SpacesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2.5"/>
    <circle cx="18" cy="6" r="2.5"/>
    <circle cx="6" cy="18" r="2.5"/>
    <circle cx="18" cy="18" r="2.5"/>
  </svg>
)
const DocsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
)
const InviteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/>
    <line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
)

/**
 * Rail vertical à esquerda da Sidebar. Botões com ícone grande + label embaixo.
 *
 * Props:
 *  - onOpenInvite: handler pra abrir Configurações do espaço na aba Membros
 *  - onOpenSpacesMenu: handler pra abrir dropdown de espaços (opcional)
 */
export default function NavRail({ onOpenInvite, onOpenSpacesMenu }) {
  const navigate = useNavigate()
  const { activeSpace } = useApp()

  function goHome() {
    navigate('/')
  }

  function goSpaces() {
    if (onOpenSpacesMenu) onOpenSpacesMenu()
    else navigate('/')
  }

  function goDocs() {
    // Placeholder: futuro
    alert('Documentos: em breve.')
  }

  function openInvite() {
    if (onOpenInvite) onOpenInvite()
    else alert('Selecione um espaço primeiro pra convidar membros.')
  }

  return (
    <nav className={styles.rail} aria-label="Navegação principal">
      <button className={styles.item} onClick={goHome} title="Início" aria-label="Início">
        <span className={styles.icon}><HomeIcon /></span>
        <span className={styles.label}>Início</span>
      </button>

      <button className={styles.item} onClick={goSpaces} title="Espaços" aria-label="Espaços">
        <span className={styles.icon}><SpacesIcon /></span>
        <span className={styles.label}>Espaços</span>
      </button>

      <button className={styles.item} onClick={goDocs} title="Documentos" aria-label="Documentos">
        <span className={styles.icon}><DocsIcon /></span>
        <span className={styles.label}>Documentos</span>
      </button>

      <div className={styles.spacer} />

      <button
        className={`${styles.item} ${styles.itemAccent}`}
        onClick={openInvite}
        title="Convidar"
        aria-label="Convidar"
        disabled={!activeSpace}
      >
        <span className={styles.icon}><InviteIcon /></span>
        <span className={styles.label}>Convidar</span>
      </button>
    </nav>
  )
}
