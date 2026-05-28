import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { AppProvider } from './hooks/useApp'
import { ThemeProvider } from './hooks/useTheme'
import AuthPage from './pages/Auth'
import AppPage from './pages/App'
import InvitePage from './pages/Invite'
import ResetPasswordPage from './pages/ResetPassword'

function Root() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
        Carregando...
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {!user ? (
        <Route path="*" element={<AuthPage />} />
      ) : (
        <>
          <Route path="/space/:spaceId/list/:listId" element={<AppShell />} />
          <Route path="/space/:spaceId" element={<AppShell />} />
          <Route path="*" element={<AppShell />} />
        </>
      )}
    </Routes>
  )
}

function AppShell() {
  return (
    <AppProvider>
      <AppPage />
    </AppProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
