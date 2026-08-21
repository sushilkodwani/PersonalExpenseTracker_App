/**
 * Parser for expense text pasted out of Apple Notes.
 *
 * The source format is loose — bullets and checkboxes vary depending on how the
 * note was copied ("- [x] Ghar - 10,000", "✓ Ghar - 10,000", "◦ Ghar - 10,000").
 * Indentation is unreliable after copy/paste, so section headers are detected by
 * matching the known section names from Settings rather than by leading spaces.
 */

export interface ParsedRow {
  sectionName: string | null
  name: string
  amount: number
  paid: boolean
  isTransfer: boolean
}

const MARKER = /^[\s\t]*(?:[-*•◦‣]|◦)?\s*(?:\[( |x|X)\]|(✓|✔|☑))?\s*/
const AMOUNT_LINE = /^(.*?)[\s]*[-–—:][\s]*([\d][\d,\s]*)\s*(\(\s*T\s*\))?\s*$/
const SEPARATOR = /^[\s]*[-–—_=]{3,}[\s]*$/
/** "Sal - 1,69,000" style footer totals aren't expenses. */
const TOTAL_LINE = /^(sal|salary|total)\b/i

/**
 * A section heading may carry any kind of subtotal after the name
 * ("Axis CC", "Axis CC - 6,097", "Axis CC - 6097 + 50,200(T)"), so match on the
 * name prefix rather than trying to parse whatever follows it.
 */
function matchSectionName(body: string, knownSectionNames: string[]): string | null {
  const lower = body.toLowerCase()
  let best: string | null = null
  for (const name of knownSectionNames) {
    const n = name.toLowerCase()
    if (!lower.startsWith(n)) continue
    const rest = lower.slice(n.length).trim()
    // Either the line is just the name, or the remainder is a subtotal.
    if (rest === '' || /^[-–—:]/.test(rest)) {
      if (!best || name.length > best.length) best = name
    }
  }
  return best
}

export function parseNotes(text: string, knownSectionNames: string[]): ParsedRow[] {
  const rows: ParsedRow[] = []
  let currentSection: string | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || SEPARATOR.test(line)) continue

    const markerMatch = rawLine.match(MARKER)
    const paid = !!(markerMatch && (markerMatch[1]?.toLowerCase() === 'x' || markerMatch[2]))
    const body = rawLine.replace(MARKER, '').trim()
    if (!body || TOTAL_LINE.test(body)) continue

    // A line naming a known section starts a new group, whatever subtotal follows it.
    const asSection = matchSectionName(body, knownSectionNames)
    if (asSection) {
      currentSection = asSection
      continue
    }

    const amountMatch = body.match(AMOUNT_LINE)
    if (!amountMatch) continue
    const bareName = amountMatch[1].trim()
    if (!bareName) continue

    const amount = Number(amountMatch[2].replace(/[,\s]/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) continue

    rows.push({
      sectionName: currentSection,
      name: bareName,
      amount,
      paid,
      isTransfer: !!amountMatch[3],
    })
  }

  return rows
}
