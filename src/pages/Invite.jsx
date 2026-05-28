import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './Auth.module.css'

export default function InvitePage() {
  const { token } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, invitation: null, error: '' })
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // RPC com security definer: anon e authenticated podem consultar
      // o convite pelo token sem precisar de policy de leitura aberta.
      const { data, error } = await supabase.rpc('get_invitation_by_token', { p_token: token })

      if (cancelled) return
      const inv = Array.isArray(data) ? data[0] : data
      if (error || !inv) {
        setState({ loading: false, invitation: null, error: 'Convite inválido ou expirado.' })
        return
      }
      if (inv.accepted_at) {
        setState({ loading: false, invitation: inv, error: 'Este convite já foi usado.' })
        return
      }
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        setState({ loading: false, invitation: inv, error: 'Este convite expirou.' })
        return
      }
      setState({ loading: false, invitation: inv, error: '' })
    }
    load()
    return () => { cancelled = true }
  }, [token])

  async function accept() {
    if (!user) {
      navigate(`/?next=/invite/${token}`)
      return
    }
    setAccepting(true)
    const { invitation } = state

    const { error: memberError } = await supabase
      .from('space_members')
      .upsert(
        { space_id: invitation.space_id, user_id: user.id, role: invitation.role || 'member' },
        { onConflict: 'space_id,user_id' }
      )

    if (memberError) {
      setState(s => ({ ...s, error: memberError.message }))
      setAccepting(false)
      return
    }

    await supabase
      .from('space_invitations')
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq('id', invitation.id)

    navigate(`/space/${invitation.space_id}`)
  }

  if (authLoading || state.loading) {
    return <div className={styles.wrapper}><div className={styles.card}>Carregando convite...</div></div>
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          <span className={styles.logoText}>Gestão de Projetos</span>
        </div>
        <h1 className={styles.title}>Convite para espaço</h1>

        {state.error && <p className={styles.error}>{state.error}</p>}

        {state.invitation && !state.error && (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Você foi convidado a entrar no espaço{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {state.invitation.space_name}
              </strong>{' '}
              como <strong>{state.invitation.role}</strong>.
            </p>
            {user ? (
              <button className={styles.btnPrimary} onClick={accept} disabled={accepting}>
                {accepting ? 'Entrando...' : 'Aceitar convite'}
              </button>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
                  Faça login ou crie uma conta para aceitar.
                </p>
                <Link to="/" className={styles.btnPrimary} style={{ display: 'inline-block', textAlign: 'center' }}>
                  Entrar
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
