import { stringifyCellValue } from '../model/cell'
import type { SheetDocument } from '../model/document'

export function exportCsv(document: SheetDocument): string {
  const rows = [
    document.columns.map((column) => column.title),
    ...document.rows.map((row) => document.columns.map((column) => stringifyCellValue(row.cells[column.id] ?? ''))),
  ]

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '""')}"`
}
