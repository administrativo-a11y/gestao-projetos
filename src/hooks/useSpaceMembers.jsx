import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useSpaceMembers(spaceId) {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!spaceId) return
    setLoading(true)
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('space_members')
        .select('*, profiles(id, name, email, avatar_url)')
        .eq('space_id', spaceId)
        .order('joined_at'),
      supabase
        .from('space_invitations')
        .select('*')
        .eq('space_id', spaceId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ])
    setMembers(membersRes.data ?? [])
    setInvitations(invitesRes.data ?? [])
    setLoading(false)
  }, [spaceId])

  useEffect(() => { refetch() }, [refetch])

  async function updateRole(memberId, newRole) {
    const { error } = await supabase
      .from('space_members')
      .update({ role: newRole })
      .eq('id', memberId)
    if (!error) await refetch()
    return { error }
  }

  async function removeMember(memberId) {
    const { error } = await supabase.from('space_members').delete().eq('id', memberId)
    if (!error) await refetch()
    return { error }
  }

  async function createInvitation({ email, role }) {
    const payload = {
      space_id: spaceId,
      role: role ?? 'member',
      invited_by: user?.id,
    }
    if (email && email.trim()) payload.email = email.trim().toLowerCase()
    const { data, error } = await supabase
      .from('space_invitations')
      .insert(payload)
      .select()
      .single()
    if (!error) await refetch()
    return { data, error }
  }

  async function revokeInvitation(invitationId) {
    const { error } = await supabase
      .from('space_invitations')
      .delete()
      .eq('id', invitationId)
    if (!error) await refetch()
    return { error }
  }

  function inviteUrl(token) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/invite/${token}`
  }

  function ownersCount() {
    return members.filter(m => m.role === 'owner').length
  }

  return {
    members, invitations, loading,
    updateRole, removeMember,
    createInvitation, revokeInvitation,
    inviteUrl, ownersCount,
    refetch,
  }
}
