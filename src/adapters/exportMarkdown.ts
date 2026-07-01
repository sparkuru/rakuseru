import { stringifyCellValue } from '../model/cell'
import type { SheetDocument } from '../model/document'

export function exportMarkdown(document: SheetDocument): string {
  const headers = document.columns.map((column) => escapeMarkdownCell(column.title))
  const separator = document.columns.map(() => '---')
  const rows = document.rows.map((row) =>
    document.columns.map((column) => escapeMarkdownCell(stringifyCellValue(row.cells[column.id] ?? ''))),
  )

  return [`# ${document.title}`, '', toTableRow(headers), toTableRow(separator), ...rows.map(toTableRow), ''].join('\n')
}

function toTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}
