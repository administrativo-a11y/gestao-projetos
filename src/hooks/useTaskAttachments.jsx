import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRealtimeSync } from './useRealtimeSync'

const BUCKET = 'task-attachments'

export function useTaskAttachments(taskId, spaceId) {
  const { user } = useAuth()
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    const { data } = await supabase
      .from('task_attachments')
      .select('*, uploader:profiles!task_attachments_uploaded_by_fkey(id, name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    setAttachments(data ?? [])
    setLoading(false)
  }, [taskId])

  useEffect(() => { refetch() }, [refetch])

  const subs = useMemo(() => taskId ? [
    { table: 'task_attachments', filter: `task_id=eq.${taskId}` },
  ] : [], [taskId])
  useRealtimeSync(taskId ? `attachments:${taskId}` : null, subs, refetch)

  async function upload(file) {
    if (!user || !taskId || !spaceId) return { error: new Error('Faltam dados') }
    setError('')
    setUploading(true)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${spaceId}/${taskId}/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (upErr) { setError(upErr.message); setUploading(false); return { error: upErr } }

    const { error: insErr } = await supabase
      .from('task_attachments')
      .insert({
        task_id: taskId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        uploaded_by: user.id,
      })

    setUploading(false)
    if (insErr) {
      await supabase.storage.from(BUCKET).remove([path])
      setError(insErr.message)
      return { error: insErr }
    }
    await refetch()
    return { error: null }
  }

  async function getDownloadUrl(attachment) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(attachment.file_path, 60)
    if (error) return { error }
    return { url: data.signedUrl }
  }

  async function remove(attachment) {
    setError('')
    const { error: delErr } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachment.id)
    if (delErr) { setError(delErr.message); return { error: delErr } }
    await supabase.storage.from(BUCKET).remove([attachment.file_path])
    await refetch()
    return { error: null }
  }

  return { attachments, loading, uploading, error, upload, getDownloadUrl, remove, refetch }
}
