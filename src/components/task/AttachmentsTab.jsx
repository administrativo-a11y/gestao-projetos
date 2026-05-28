import { useRef, useState } from 'react'
import { useTaskAttachments } from '../../hooks/useTaskAttachments'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import styles from './AttachmentsTab.module.css'

function FileIcon({ type }) {
  const t = type ?? ''
  const cat = t.startsWith('image/') ? 'image'
    : t.startsWith('video/') ? 'video'
    : t.startsWith('audio/') ? 'audio'
    : t === 'application/pdf' ? 'pdf'
    : t.includes('spreadsheet') || t.includes('excel') || t.includes('csv') ? 'sheet'
    : t.includes('zip') || t.includes('compressed') ? 'zip'
    : 'file'

  const svgs = {
    image: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    video: <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>,
    audio: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>,
    sheet: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></>,
    zip: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="12" y1="11" x2="12" y2="19"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
  }

  return (
    <svg className={styles.fileIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {svgs[cat]}
    </svg>
  )
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getInitials(n) {
  return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

export default function AttachmentsTab({ taskId, spaceId }) {
  const { attachments, loading, uploading, error, upload, getDownloadUrl, remove } = useTaskAttachments(taskId, spaceId)
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(null)

  async function handleFiles(files) {
    for (const f of files) {
      await upload(f)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files ?? []))
  }

  async function handleDownload(att) {
    setBusy(att.id)
    const { url, error } = await getDownloadUrl(att)
    setBusy(null)
    if (error || !url) return alert(error?.message ?? 'Não foi possível baixar.')
    window.open(url, '_blank', 'noopener')
  }

  async function handleDelete(att) {
    if (!confirm(`Excluir "${att.file_name}"?`)) return
    setBusy(att.id)
    await remove(att)
    setBusy(null)
  }

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>
          {uploading ? 'Enviando...' : (
            <>Arraste arquivos aqui ou <span className={styles.link}>clique para selecionar</span></>
          )}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.empty}>Carregando...</div>
      ) : attachments.length === 0 ? (
        <div className={styles.empty}>Nenhum arquivo anexado ainda.</div>
      ) : (
        <ul className={styles.list}>
          {attachments.map(att => (
            <li key={att.id} className={styles.item}>
              <FileIcon type={att.file_type} />
              <div className={styles.itemInfo}>
                <button className={styles.itemName} onClick={() => handleDownload(att)} disabled={busy === att.id}>
                  {att.file_name}
                </button>
                <div className={styles.itemMeta}>
                  <span>{formatSize(att.file_size)}</span>
                  <span>·</span>
                  <span className={styles.uploader}>
                    {att.uploader?.avatar_url
                      ? <img src={att.uploader.avatar_url} alt="" className={styles.uploaderAvatar} />
                      : <span className={styles.uploaderAvatar}>{getInitials(att.uploader?.name)}</span>}
                    {att.uploader?.name ?? 'Desconhecido'}
                  </span>
                  <span>·</span>
                  <span>{format(new Date(att.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(att)}
                disabled={busy === att.id}
                aria-label="Excluir"
                title="Excluir"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
