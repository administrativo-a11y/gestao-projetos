import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './Auth.module.css'

const EyeOn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.77 19.77 0 0 1-2.16 3.19"/>
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

export default function AuthPage() {
  const { signIn, signUp, resetPasswordForEmail } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    } else if (mode === 'signup') {
      if (!name.trim()) { setError('Informe seu nome.'); setLoading(false); return }
      const { error } = await signUp(email, password, name)
      if (error) setError(error.message)
      else setSuccess('Conta criada! Verifique seu e-mail para confirmar.')
    } else if (mode === 'forgot') {
      if (!email.trim()) { setError('Informe seu e-mail.'); setLoading(false); return }
      const { error } = await resetPasswordForEmail(email.trim())
      if (error) setError(error.message)
      else setSuccess('Enviamos um link para redefinir sua senha. Confira seu e-mail.')
    }
    setLoading(false)
  }

  function switchMode(next) {
    resetMessages()
    setPassword('')
    setShowPassword(false)
    setMode(next)
  }

  const titles = {
    login: 'Entrar',
    signup: 'Criar conta',
    forgot: 'Recuperar senha',
  }

  const submitLabels = {
    login: 'Entrar',
    signup: 'Criar conta',
    forgot: 'Enviar link',
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          <span className={styles.logoText}>Gestão de Projetos</span>
        </div>

        <h1 className={styles.title}>{titles[mode]}</h1>

        {mode === 'forgot' && (
          <p className={styles.hint}>
            Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'signup' && (
            <div className={styles.field}>
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {mode !== 'forgot' && (
            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <label htmlFor="password">Senha</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className={styles.forgotBtn}
                    onClick={() => switchMode('forgot')}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  title={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Aguarde...' : submitLabels[mode]}
          </button>
        </form>

        {mode === 'forgot' ? (
          <button type="button" className={styles.backBtn} onClick={() => switchMode('login')}>
            ← Voltar para login
          </button>
        ) : (
          <p className={styles.toggle}>
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
            {' '}
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
