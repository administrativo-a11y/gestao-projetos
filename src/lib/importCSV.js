// Parser CSV simples e robusto, sem dependências.
// Suporta:
// - Delimitador `,` ou `;` (auto-detectado pela primeira linha)
// - Aspas duplas escapando campos com vírgulas/quebras de linha
// - Aspas escapadas dentro de aspas: `""` → `"`
// - BOM UTF-8 no início
// - Linhas vazias (ignoradas)
// - CRLF e LF como quebras de linha

/**
 * @param {string} text  conteúdo bruto do arquivo CSV
 * @returns {{ headers: string[], rows: object[], delimiter: string }}
 */
export function parseCSV(text) {
  if (typeof text !== 'string') throw new Error('Conteúdo do CSV inválido')

  // Remove BOM
  let content = text
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
  // Normaliza quebras de linha
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Detecta delimitador na primeira linha sem aspas
  const firstLineEnd = content.indexOf('\n')
  const firstLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd)
  const countComma = countOutsideQuotes(firstLine, ',')
  const countSemi = countOutsideQuotes(firstLine, ';')
  const delimiter = countSemi > countComma ? ';' : ','

  // Tokeniza
  const rows = []
  let cur = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < content.length) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
    } else {
      if (c === '"') {
        // Aspas só são abertura se estiver no começo do campo
        if (field === '') { inQuotes = true; i++; continue }
        field += c; i++
      } else if (c === delimiter) {
        cur.push(field)
        field = ''
        i++
      } else if (c === '\n') {
        cur.push(field)
        rows.push(cur)
        cur = []
        field = ''
        i++
      } else {
        field += c
        i++
      }
    }
  }
  // Última célula/linha
  if (field !== '' || cur.length > 0) {
    cur.push(field)
    rows.push(cur)
  }

  // Remove linhas totalmente vazias
  const cleaned = rows.filter(r => r.some(cell => cell.trim() !== ''))
  if (cleaned.length === 0) {
    return { headers: [], rows: [], delimiter }
  }

  const headers = cleaned[0].map(h => h.trim())
  const dataRows = cleaned.slice(1).map(r => {
    const obj = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (r[j] ?? '').trim()
    }
    return obj
  })

  return { headers, rows: dataRows, delimiter }
}

function countOutsideQuotes(line, char) {
  let count = 0
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { i++; continue }
      inQuotes = !inQuotes
    } else if (!inQuotes && c === char) {
      count++
    }
  }
  return count
}
