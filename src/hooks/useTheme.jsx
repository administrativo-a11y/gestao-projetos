import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'gp.theme'
const VALID = ['light', 'dark', 'system']

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return VALID.includes(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolveActive(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function applyTheme(active) {
  document.documentElement.setAttribute('data-theme', active)
}

export function ThemeProvider({ children }) {
  const { profile, user } = useAuth()
  const [preference, setPreference] = useState(readStored)
  const [active, setActive] = useState(() => resolveActive(readStored()))

  // Aplica tema sempre que muda
  useEffect(() => {
    applyTheme(active)
  }, [active])

  // Acompanha prefers-color-scheme quando preferência é 'system'
  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    function listener() { setActive(mql.matches ? 'dark' : 'light') }
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [preference])

  // Sincroniza com profile.theme_preference quando o perfil carrega
  useEffect(() => {
    if (!profile?.theme_preference) return
    if (!VALID.includes(profile.theme_preference)) return
    if (profile.theme_preference === preference) return
    setPreference(profile.theme_preference)
    setActive(resolveActive(profile.theme_preference))
  }, [profile?.theme_preference])

  const setTheme = useCallback(async (next) => {
    if (!VALID.includes(next)) return
    setPreference(next)
    setActive(resolveActive(next))
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    if (user?.id) {
      await supabase.from('profiles').update({ theme_preference: next }).eq('id', user.id)
    }
  }, [user?.id])

  return (
    <ThemeContext.Provider value={{ preference, active, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
