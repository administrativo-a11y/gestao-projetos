import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const ProjectsContext = createContext(null)

export function ProjectsProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(user_id, role)')
      .order('created_at', { ascending: true })
    setProjects(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  async function createProject({ name, description, color }) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, description, color, owner_id: user.id })
      .select()
      .single()
    await fetchProjects()
    return { data, error }
  }

  async function updateProject(id, updates) {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
    await fetchProjects()
    return { error }
  }

  async function deleteProject(id) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
    await fetchProjects()
    return { error }
  }

  async function inviteMember(projectId, email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (!profile) return { error: { message: 'Usuário não encontrado. Peça para ele criar uma conta primeiro.' } }

    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: profile.id, role: 'member' })

    return { error }
  }

  return (
    <ProjectsContext.Provider value={{ projects, loading, createProject, updateProject, deleteProject, inviteMember, refetch: fetchProjects }}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  return useContext(ProjectsContext)
}
