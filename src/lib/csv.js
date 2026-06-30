export function exportToCsv(filename, rows, columns) {
  if (!rows.length) return

  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escape(c.value(row))).join(','))
    .join('\n')

  const csv = `${header}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
