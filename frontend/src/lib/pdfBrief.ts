// Client-side PDF brief generation (jsPDF — no backend round trip, no
// server-side rendering dependency, consistent with this app's "every
// connector that exists is real, everything else stays honestly local"
// posture). Light-themed by design, deliberately distinct from the app's
// own dark "institutional terminal" UI — a document meant to be printed
// or forwarded reads better on white than on a dark background, the same
// reasoning behind the project's Word report.

import { jsPDF } from 'jspdf'

const PAGE_W = 595.28 // A4 pt
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

const NAVY: [number, number, number] = [19, 42, 58]
const TEAL: [number, number, number] = [15, 139, 141]
const TEAL_DARK: [number, number, number] = [11, 102, 104]
const SLATE: [number, number, number] = [43, 47, 54]
const MUTED: [number, number, number] = [91, 102, 112]
const LIGHT_BG: [number, number, number] = [234, 244, 244]
const LINE: [number, number, number] = [216, 226, 225]
const RED: [number, number, number] = [166, 51, 62]
const AMBER: [number, number, number] = [184, 116, 43]
const GREEN: [number, number, number] = [23, 140, 110]

export interface PdfStat {
  label: string
  value: string
  tone?: 'teal' | 'red' | 'amber' | 'green' | 'default'
}

const TONE_COLOR: Record<NonNullable<PdfStat['tone']>, [number, number, number]> = {
  teal: TEAL_DARK,
  red: RED,
  amber: AMBER,
  green: GREEN,
  default: SLATE,
}

class BriefBuilder {
  doc: jsPDF
  y = MARGIN
  page = 1
  private title: string
  private subtitle: string

  constructor(title: string, subtitle: string) {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4' })
    this.title = title
    this.subtitle = subtitle
    this.drawHeader()
  }

  private drawHeader() {
    const d = this.doc
    d.setFillColor(...NAVY)
    d.rect(0, 0, PAGE_W, 86, 'F')
    d.setTextColor(255, 255, 255)
    d.setFont('helvetica', 'bold')
    d.setFontSize(17)
    d.text(this.title, MARGIN, 40)
    d.setFont('helvetica', 'normal')
    d.setFontSize(9.5)
    d.setTextColor(180, 220, 220)
    d.text(this.subtitle, MARGIN, 58)
    d.setFontSize(8)
    d.setTextColor(150, 190, 190)
    d.text(`CLIMATRIX INDIA · Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, MARGIN, 74)
    this.y = 104
  }

  private newPage() {
    this.doc.addPage()
    this.page += 1
    this.y = MARGIN
    const d = this.doc
    d.setFont('helvetica', 'normal')
    d.setFontSize(8)
    d.setTextColor(...MUTED)
    d.text(this.title, MARGIN, 24)
    d.setDrawColor(...LINE)
    d.line(MARGIN, 30, PAGE_W - MARGIN, 30)
    this.y = 46
  }

  private ensure(space: number) {
    if (this.y + space > PAGE_H - 50) this.newPage()
  }

  heading(text: string) {
    this.ensure(26)
    const d = this.doc
    d.setFont('helvetica', 'bold')
    d.setFontSize(12.5)
    d.setTextColor(...TEAL_DARK)
    d.text(text, MARGIN, this.y)
    d.setDrawColor(...TEAL)
    d.setLineWidth(1.2)
    d.line(MARGIN, this.y + 4, MARGIN + 28, this.y + 4)
    this.y += 20
  }

  subheading(text: string) {
    this.ensure(18)
    const d = this.doc
    d.setFont('helvetica', 'bold')
    d.setFontSize(10)
    d.setTextColor(...NAVY)
    d.text(text, MARGIN, this.y)
    this.y += 14
  }

  paragraph(text: string, opts: { italic?: boolean; color?: [number, number, number]; size?: number } = {}) {
    const d = this.doc
    d.setFont('helvetica', opts.italic ? 'italic' : 'normal')
    d.setFontSize(opts.size ?? 9.5)
    d.setTextColor(...(opts.color ?? SLATE))
    const lines = d.splitTextToSize(text, CONTENT_W) as string[]
    this.ensure(lines.length * 13 + 4)
    d.text(lines, MARGIN, this.y)
    this.y += lines.length * 13 + 6
  }

  bullet(text: string) {
    const d = this.doc
    d.setFont('helvetica', 'normal')
    d.setFontSize(9.5)
    d.setTextColor(...SLATE)
    const lines = d.splitTextToSize(text, CONTENT_W - 14) as string[]
    this.ensure(lines.length * 13 + 4)
    d.setTextColor(...TEAL_DARK)
    d.text('•', MARGIN, this.y)
    d.setTextColor(...SLATE)
    d.text(lines, MARGIN + 12, this.y)
    this.y += lines.length * 13 + 5
  }

  spacer(n = 8) {
    this.y += n
  }

  statRow(stats: PdfStat[]) {
    const d = this.doc
    const gap = 10
    const w = (CONTENT_W - gap * (stats.length - 1)) / stats.length
    const h = 46
    this.ensure(h + 8)
    stats.forEach((s, i) => {
      const x = MARGIN + i * (w + gap)
      d.setFillColor(...LIGHT_BG)
      d.setDrawColor(...LINE)
      d.roundedRect(x, this.y, w, h, 3, 3, 'FD')
      d.setFont('helvetica', 'normal')
      d.setFontSize(7.5)
      d.setTextColor(...MUTED)
      d.text(s.label.toUpperCase(), x + 8, this.y + 15, { maxWidth: w - 16 })
      d.setFont('helvetica', 'bold')
      d.setFontSize(13)
      d.setTextColor(...TONE_COLOR[s.tone ?? 'default'])
      d.text(s.value, x + 8, this.y + 34)
    })
    this.y += h + 14
  }

  table(headers: string[], rows: string[][], colWidths?: number[]) {
    const d = this.doc
    const widths = colWidths ?? headers.map(() => CONTENT_W / headers.length)
    const rowH = 18
    this.ensure(rowH * (rows.length + 1) + 6)

    let x = MARGIN
    d.setFillColor(...TEAL_DARK)
    d.rect(MARGIN, this.y, CONTENT_W, rowH, 'F')
    d.setFont('helvetica', 'bold')
    d.setFontSize(8.5)
    d.setTextColor(255, 255, 255)
    headers.forEach((h, i) => {
      d.text(h, x + 6, this.y + 12.5, { maxWidth: widths[i] - 10 })
      x += widths[i]
    })
    this.y += rowH

    rows.forEach((row, ri) => {
      this.ensure(rowH)
      x = MARGIN
      if (ri % 2 === 1) {
        d.setFillColor(...LIGHT_BG)
        d.rect(MARGIN, this.y, CONTENT_W, rowH, 'F')
      }
      d.setFont('helvetica', 'normal')
      d.setFontSize(8.5)
      d.setTextColor(...SLATE)
      row.forEach((cell, ci) => {
        d.text(String(cell), x + 6, this.y + 12.5, { maxWidth: widths[ci] - 10 })
        x += widths[ci]
      })
      this.y += rowH
    })
    d.setDrawColor(...LINE)
    d.rect(MARGIN, this.y - rowH * (rows.length + 1), CONTENT_W, rowH * (rows.length + 1))
    this.y += 10
  }

  calloutBox(title: string, body: string, tone: 'teal' | 'amber' | 'red' = 'teal') {
    const color = tone === 'teal' ? TEAL : tone === 'amber' ? AMBER : RED
    const d = this.doc
    d.setFont('helvetica', 'normal')
    d.setFontSize(9.5)
    const lines = d.splitTextToSize(body, CONTENT_W - 20) as string[]
    const h = 22 + lines.length * 13
    this.ensure(h + 8)
    d.setFillColor(...LIGHT_BG)
    d.setDrawColor(...color)
    d.setLineWidth(1)
    d.roundedRect(MARGIN, this.y, CONTENT_W, h, 3, 3, 'FD')
    d.setFont('helvetica', 'bold')
    d.setFontSize(9)
    d.setTextColor(...color)
    d.text(title, MARGIN + 10, this.y + 15)
    d.setFont('helvetica', 'normal')
    d.setFontSize(9.5)
    d.setTextColor(...SLATE)
    d.text(lines, MARGIN + 10, this.y + 30)
    this.y += h + 12
  }

  finish(filename: string) {
    const totalPages = this.doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      this.doc.setPage(p)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(7.5)
      this.doc.setTextColor(...MUTED)
      this.doc.text(
        'CLIMATRIX India — synthetic demonstration portfolio unless stated otherwise. Modelled figures, not investment advice.',
        MARGIN,
        PAGE_H - 28,
      )
      this.doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN - 60, PAGE_H - 28)
    }
    this.doc.save(filename)
  }
}

export { BriefBuilder }
