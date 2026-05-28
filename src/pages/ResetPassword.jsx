import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ready, setReady] = useState(false)

  // Supabase coloca o token de recovery no hash da URL e cria uma sessão
  // temporária com event PASSWORD_RECOVERY. Aqui só confirmamos que existe sessão.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session) {
        setError('Link de redefinição inválido ou expirado. Solicite um novo.')
      }
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Senha atualizada! Redirecionando...')
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          <span className={styles.logoText}>Gestão de Projetos</span>
        </div>

        <h1 className={styles.title}>Nova senha</h1>
        <p className={styles.hint}>Defina sua nova senha. Você ficará logado em seguida.</p>

        {!ready ? (
          <p className={styles.hint}>Verificando link...</p>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="np">Nova senha</label>
              <div className={styles.passwordWrap}>
                <input
                  id="np"
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShow(v => !v)}
                  aria-label={show ? 'Esconder' : 'Mostrar'}
                >
                  {show ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="cp">Confirmar nova senha</label>
              <div className={styles.passwordWrap}>
                <input
                  id="cp"
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}

            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <button type="button" className={styles.backBtn} onClick={() => navigate('/', { replace: true })}>
          ← Voltar
        </button>
      </div>
    </div>
  )
}
