import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseCSV } from '../../lib/importCSV'
import { parseMSProject } from '../../lib/importMSProject'
import { autoDetectMapping } from '../../lib/importMappingDetect'
import { useImport } from '../../hooks/useImport'
import { useApp } from '../../hooks/useApp'
import modalStyles from '../shared/Modal.module.css'
import styles from './ImportModal.module.css'

const FIELD_DESTS = [
  { id: 'title', label: 'Título' },
  { id: 'description', label: 'Descrição' },
  { id: 'start_date', label: 'Início' },
  { id: 'due_date', label: 'Prazo' },
  { id: 'priority', label: 'Prioridade' },
  { id: 'status', label: 'Status (por nome)' },
  { id: 'assignee_email', label: 'Responsável (e-mail)' },
  { id: 'assignee_name', label: 'Responsável (nome)' },
  { id: 'tag', label: 'Tag' },
  { id: 'custom_field', label: 'Campo personalizado' },
  { id: '__ignore__', label: 'Ignorar' },
]
const CF_TYPES = [
  { id: 'text', label: 'Texto' },
  { id: 'number', label: 'Número' },
  { id: 'date', label: 'Data' },
  { id: 'currency', label: 'Valor (R$)' },
  { id: 'url', label: 'URL' },
  { id: 'email', label: 'E-mail' },
  { id: 'phone', label: 'Telefone' },
]

export default function ImportModal({ space, onClose, initialTarget }) {
  // initialTarget pode ser:
  //   { type: 'folder', folderId }  → pré-seleciona "nova lista nesta pasta"
  //   { type: 'list', listId }      → pré-seleciona "adicionar a esta lista"
  const { lists, folders } = useApp()
  const navigate = useNavigate()
  const { doImport, importing, progress, lastResult } = useImport()

  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [kind, setKind] = useState(null) // 'csv' | 'xml'
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Step 2 — defaults baseados em initialTarget
  const [destination, setDestination] = useState(
    initialTarget?.type === 'list' ? 'existing' : 'new'
  )
  const [listName, setListName] = useState('')
  const [targetListId, setTargetListId] = useState(
    initialTarget?.type === 'list' ? initialTarget.listId : ''
  )
  const [targetFolderId, setTargetFolderId] = useState(
    initialTarget?.type === 'folder' ? initialTarget.folderId : ''
  )

  // Step 3 (CSV)
  const [mapping, setMapping] = useState({})

  const fileInputRef = useRef(null)

  const spaceLists = useMemo(
    () => lists.filter(l => !l.archived_at && !l.deleted_at),
    [lists]
  )
  const spaceFolders = useMemo(
    () => folders.filter(f => !f.archived_at && !f.deleted_at),
    [folders]
  )

  function pickFile(f) {
    setParseError('')
    setFile(f)
    const name = f.name.toLowerCase()
    const isXml = name.endsWith('.xml')
    const isCsv = name.endsWith('.csv')
    if (!isXml && !isCsv) {
      setParseError('Formato não suportado. Use .xml (MS Project) ou .csv.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      try {
        if (isXml) {
          const result = parseMSProject(text)
          setKind('xml')
          setParsed(result)
          setListName(result.listName)
          setStep(2)
        } else {
          const csv = parseCSV(text)
          if (csv.rows.length === 0) {
            setParseError('CSV vazio ou sem linhas válidas.')
            return
          }
          const det = autoDetectMapping(csv.headers)
          setKind('csv')
          setParsed(csv)
          setMapping(det)
          setListName(f.name.replace(/\.csv$/i, ''))
          setStep(2)
        }
      } catch (err) {
        setParseError(err.message ?? String(err))
      }
    }
    reader.onerror = () => setParseError('Erro ao ler o arquivo.')
    reader.readAsText(f, 'utf-8')
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  async function handleConfirm() {
    const args = {
      spaceId: space.id,
      targetListId: destination === 'existing' ? targetListId : null,
      listName: destination === 'new' ? listName : null,
      folderId: destination === 'new' ? (targetFolderId || null) : null,
      source: parsed,
      mapping: kind === 'csv' ? mapping : null,
      kind,
    }
    const result = await doImport(args)
    if (result?.ok && result.listId) {
      // ficar no passo 4 mostrando sucesso (não navega ainda)
    }
  }

  function openCreatedList() {
    if (lastResult?.listId) {
      navigate(`/space/${space.id}/list/${lastResult.listId}`)
      onClose()
    }
  }

  // Counts pra resumo do step 4
  const counts = useMemo(() => {
    if (!parsed) return null
    if (kind === 'xml') {
      const tasks = parsed.tasks.length
      const subs = parsed.tasks.reduce((acc, t) => acc + (t.subtasks?.length ?? 0), 0)
      const deps = parsed.dependencies.length
      const newFields = 0
      const emails = new Set()
      parsed.tasks.forEach(t => (t.assignee_emails ?? []).forEach(e => emails.add(e)))
      return { tasks, subs, deps, customFields: newFields, emails: [...emails] }
    }
    if (kind === 'csv') {
      const tasks = parsed.rows.length
      const newFields = Object.values(mapping).filter(m => m.dest === 'custom_field').length
      const emails = new Set()
      const emailHeader = Object.entries(mapping).find(([, m]) => m.dest === 'assignee_email')?.[0]
      if (emailHeader) {
        for (const r of parsed.rows) {
          const v = r[emailHeader]?.trim().toLowerCase()
          if (v) emails.add(v)
        }
      }
      return { tasks, subs: 0, deps: 0, customFields: newFields, emails: [...emails] }
    }
    return null
  }, [parsed, kind, mapping])

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && !importing && onClose()}>
      <div className={`${modalStyles.modal} ${modalStyles.wideModal} ${styles.modal}`} role="dialog" aria-label="Importar">
        <header className={modalStyles.header}>
          <h2 className={modalStyles.title}>Importar projeto</h2>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Fechar" disabled={importing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        {/* Stepper */}
        <div className={styles.steps}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`${styles.step} ${step === n ? styles.stepActive : ''} ${n < step ? styles.stepDone : ''}`}>
              <span className={styles.stepNum}>{n}</span>
              <span className={styles.stepLabel}>
                {n === 1 ? 'Arquivo' : n === 2 ? 'Destino' : n === 3 ? 'Mapeamento' : 'Confirmar'}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.body}>
          {/* STEP 1: Arquivo */}
          {step === 1 && (
            <>
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className={styles.dropTitle}>Arraste seu arquivo aqui</p>
                <p className={styles.dropHint}>ou clique pra selecionar — aceita .xml (MS Project) ou .csv</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
                />
              </div>
              {parseError && <p className={styles.error}>{parseError}</p>}
            </>
          )}

          {/* STEP 2: Destino */}
          {step === 2 && parsed && (
            <div className={styles.section}>
              <label className={styles.radioRow}>
                <input
                  type="radio"
                  checked={destination === 'new'}
                  onChange={() => setDestination('new')}
                />
                <span>Criar lista nova</span>
              </label>
              {destination === 'new' && (
                <div className={styles.indent}>
                  <div className={styles.field}>
                    <label>Nome da lista</label>
                    <input
                      type="text"
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Pasta (opcional)</label>
                    <select value={targetFolderId} onChange={(e) => setTargetFolderId(e.target.value)}>
                      <option value="">— Raiz do espaço —</option>
                      {spaceFolders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <label className={styles.radioRow}>
                <input
                  type="radio"
                  checked={destination === 'existing'}
                  onChange={() => setDestination('existing')}
                />
                <span>Adicionar a lista existente</span>
              </label>
              {destination === 'existing' && (
                <div className={styles.indent}>
                  <div className={styles.field}>
                    <label>Lista</label>
                    <select value={targetListId} onChange={(e) => setTargetListId(e.target.value)}>
                      <option value="">— Selecione —</option>
                      {spaceLists.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Mapeamento (CSV) */}
          {step === 3 && kind === 'csv' && parsed && (
            <div className={styles.mapping}>
              <p className={styles.mappingHint}>
                Mapeie cada coluna do CSV para um campo nativo OU crie como campo personalizado.
              </p>
              <table className={styles.mapTable}>
                <thead>
                  <tr>
                    <th>Coluna no CSV</th>
                    <th>Destino</th>
                    <th>Tipo (se campo personalizado)</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map(h => {
                    const m = mapping[h] ?? { dest: '__ignore__' }
                    return (
                      <tr key={h}>
                        <td className={styles.headerCell}>{h}</td>
                        <td>
                          <select
                            value={m.dest}
                            onChange={(e) => setMapping(prev => ({
                              ...prev,
                              [h]: { ...prev[h], dest: e.target.value, customFieldType: prev[h]?.customFieldType ?? 'text' }
                            }))}
                          >
                            {FIELD_DESTS.map(d => (
                              <option key={d.id} value={d.id}>{d.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {m.dest === 'custom_field' ? (
                            <select
                              value={m.customFieldType ?? 'text'}
                              onChange={(e) => setMapping(prev => ({
                                ...prev,
                                [h]: { ...prev[h], dest: 'custom_field', customFieldType: e.target.value }
                              }))}
                            >
                              {CF_TYPES.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={styles.dim}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <details className={styles.preview}>
                <summary>Pré-visualizar 3 primeiras linhas</summary>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>{parsed.headers.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 3).map((r, i) => (
                      <tr key={i}>
                        {parsed.headers.map(h => <td key={h}>{r[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}

          {/* STEP 4: Resumo */}
          {step === 4 && counts && (
            <div className={styles.section}>
              {!lastResult && (
                <>
                  <p className={styles.summary}>
                    Vamos criar <strong>{counts.tasks} tarefa(s)</strong>
                    {counts.subs > 0 && <>, <strong>{counts.subs} subtarefa(s)</strong></>}
                    {counts.customFields > 0 && <>, <strong>{counts.customFields} campo(s) personalizado(s)</strong></>}
                    {counts.deps > 0 && <>, <strong>{counts.deps} dependência(s)</strong></>}.
                  </p>
                  <p className={styles.destinationInfo}>
                    Destino: {destination === 'new'
                      ? <>nova lista <strong>{listName}</strong>{targetFolderId && spaceFolders.find(f => f.id === targetFolderId) ? <> dentro da pasta <strong>{spaceFolders.find(f => f.id === targetFolderId).name}</strong></> : null}</>
                      : <>lista <strong>{spaceLists.find(l => l.id === targetListId)?.name ?? '?'}</strong></>
                    }
                  </p>
                  {kind === 'xml' && parsed.warnings?.length > 0 && (
                    <div className={styles.warningBox}>
                      <strong>Avisos:</strong>
                      <ul>
                        {parsed.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
                        {parsed.warnings.length > 10 && <li>+{parsed.warnings.length - 10} mais</li>}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {importing && (
                <div className={styles.progressWrap}>
                  <p className={styles.progressLabel}>{progress.phase}</p>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '6%' }}
                    />
                  </div>
                </div>
              )}

              {lastResult && (
                <div className={lastResult.ok ? styles.successBox : styles.errorBox}>
                  {lastResult.ok ? (
                    <>
                      <strong>Importação concluída.</strong>
                      <p>
                        Criadas: {lastResult.created} tarefa(s)
                        {lastResult.subtasks ? `, ${lastResult.subtasks} subtarefa(s)` : ''}
                        {lastResult.assignees ? `, ${lastResult.assignees} atribuição(ões)` : ''}
                        {lastResult.dependencies ? `, ${lastResult.dependencies} dependência(s)` : ''}.
                      </p>
                      {lastResult.errors?.length > 0 && (
                        <details>
                          <summary>Avisos ({lastResult.errors.length})</summary>
                          <ul>
                            {lastResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </details>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Falha na importação.</strong>
                      <ul>
                        {lastResult.errors?.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            className={modalStyles.btnSecondary}
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            disabled={importing}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < 4 && (
            <button
              className={modalStyles.btnPrimary}
              onClick={() => {
                if (step === 1) return // só avança via pickFile
                if (step === 2) {
                  if (destination === 'new' && !listName.trim()) return
                  if (destination === 'existing' && !targetListId) return
                  // CSV pula pra mapping; XML pula direto pra resumo
                  setStep(kind === 'csv' ? 3 : 4)
                  return
                }
                if (step === 3) setStep(4)
              }}
              disabled={
                step === 1 ||
                (step === 2 && destination === 'new' && !listName.trim()) ||
                (step === 2 && destination === 'existing' && !targetListId)
              }
            >
              Avançar
            </button>
          )}
          {step === 4 && !lastResult && (
            <button
              className={modalStyles.btnPrimary}
              onClick={handleConfirm}
              disabled={importing}
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          )}
          {step === 4 && lastResult?.ok && (
            <button
              className={modalStyles.btnPrimary}
              onClick={openCreatedList}
            >
              Abrir lista
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
