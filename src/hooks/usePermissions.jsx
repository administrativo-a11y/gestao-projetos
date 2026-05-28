import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useApp } from './useApp'

// Rank: admin=3, edit=2, view=1, null=0
const RANK = { admin: 3, edit: 2, view: 1 }

function rankOf(p) { return p ? (RANK[p] ?? 0) : 0 }
function highestOf(a, b) { return rankOf(a) >= rankOf(b) ? a : b }

// Permissão efetiva do usuário no espaço (sem regras de pasta)
function spaceLevel(role) {
  if (role === 'owner' || role === 'admin') return 'admin'
  if (role === 'member') return 'edit'
  if (role === 'viewer') return 'view'
  return null
}

export function usePermissions() {
  const { user } = useAuth()
  const { activeSpace, folders } = useApp()
  const [spaceMembership, setSpaceMembership] = useState(null)
  const [folderRules, setFolderRules] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user || !activeSpace) {
      setSpaceMembership(null)
      setFolderRules([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [memberRes, rulesRes] = await Promise.all([
      supabase
        .from('space_members')
        .select('role')
        .eq('space_id', activeSpace.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('folder_permissions')
        .select('*, folders!inner(space_id)')
        .eq('folders.space_id', activeSpace.id),
    ])
    setSpaceMembership(memberRes.data ?? null)
    setFolderRules(rulesRes.data ?? [])
    setLoading(false)
  }, [user, activeSpace])

  useEffect(() => { fetchAll() }, [fetchAll])

  const baseLevel = useMemo(
    () => spaceLevel(spaceMembership?.role),
    [spaceMembership?.role]
  )

  const folderAccess = useCallback((folderId) => {
    if (!spaceMembership) return null
    // Owners/admins do espaço sempre admin nas pastas
    if (spaceMembership.role === 'owner' || spaceMembership.role === 'admin') return 'admin'
    if (!folderId) return baseLevel
    const rules = folderRules.filter(r => r.folder_id === folderId)
    if (rules.length === 0) return baseLevel
    const byUser = rules.find(r => r.user_id === user?.id)
    const byRole = rules.find(r => r.role === spaceMembership.role)
    if (!byUser && !byRole) return baseLevel
    return highestOf(byUser?.permission, byRole?.permission)
  }, [spaceMembership, folderRules, baseLevel, user?.id])

  const can = useCallback((action, folderId = null) => {
    const level = folderAccess(folderId)
    if (action === 'view') return rankOf(level) >= rankOf('view')
    if (action === 'edit') return rankOf(level) >= rankOf('edit')
    if (action === 'admin') return rankOf(level) >= rankOf('admin')
    return false
  }, [folderAccess])

  const isSpaceAdmin = useMemo(() => {
    return spaceMembership?.role === 'owner' || spaceMembership?.role === 'admin'
  }, [spaceMembership?.role])

  const visibleFolders = useMemo(() => {
    return folders.filter(f => folderAccess(f.id) !== null)
  }, [folders, folderAccess])

  return {
    role: spaceMembership?.role ?? null,
    isSpaceAdmin,
    baseLevel,
    can,
    folderAccess,
    visibleFolders,
    folderRules,
    loading,
    refetch: fetchAll,
  }
}
