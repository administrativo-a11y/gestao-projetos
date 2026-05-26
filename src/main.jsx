import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { AppProvider } from './hooks/useApp'
import AuthPage from './pages/Auth'
import AppPage from './pages/App'

function Root() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
        Carregando...
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <AppProvider>
      <AppPage />
    </AppProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
)
