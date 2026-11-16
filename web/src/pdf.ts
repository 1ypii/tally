import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

type Cell = { x0: number; x1: number; text: string }
type Word = { x: number; w: number; h: number; str: string }

const maxPages = 50

export async function pdfLines(data: ArrayBuffer) {
  const task = getDocument({ data })
  const lines: Cell[][] = []
  try {
    const doc = await task.promise
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const rows: { y: number; words: Word[] }[] = []

      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = item.transform[5]
        const h = item.height || Math.abs(item.transform[3]) || 10
        const word = { x: item.transform[4], w: item.width, h, str: item.str.trim() }
        const row = rows.find((r) => Math.abs(r.y - y) < h * 0.5)
        if (row) row.words.push(word)
        else rows.push({ y, words: [word] })
      }

      rows.sort((a, b) => b.y - a.y)
      for (const row of rows) {
        row.words.sort((a, b) => a.x - b.x)
        const cells: Cell[] = []
        for (const w of row.words) {
          const last = cells[cells.length - 1]
          if (last && w.x - last.x1 < Math.max(3, w.h * 0.8)) {
            last.text += ' ' + w.str
            last.x1 = w.x + w.w
          } else cells.push({ x0: w.x, x1: w.x + w.w, text: w.str })
        }
        lines.push(cells)
      }
      page.cleanup()
    }
  } finally {
    await task.destroy()
  }
  return lines
}

export function pdfTable(lines: Cell[][], isHeader: (texts: string[]) => boolean) {
  const at = lines.findIndex((l) => isHeader(l.map((c) => c.text)))
  if (at < 0) return null
  const header = lines[at]
  const headerKey = header.map((c) => c.text).join('|')
  const table = [header.map((c) => c.text)]

  for (const line of lines.slice(at + 1)) {
    if (line.map((c) => c.text).join('|') === headerKey) continue
    const row = header.map(() => '')
    for (const cell of line) {
      let best = -1
      let bestScore = -Infinity
      header.forEach((h, i) => {
        const overlap = Math.min(cell.x1, h.x1) - Math.max(cell.x0, h.x0)
        const score = overlap > 0 ? overlap : -Math.abs((cell.x0 + cell.x1) / 2 - (h.x0 + h.x1) / 2)
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      })
      row[best] = row[best] ? row[best] + ' ' + cell.text : cell.text
    }
    table.push(row)
  }
  return table
}
