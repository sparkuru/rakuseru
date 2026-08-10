import type { ColumnDef, RowData } from './document'

export { normalizeBackgroundColor } from '../../packages/document-contract/src/index'

export const BACKGROUND_COLOR_PRESETS = ['#FFF3BF', '#D3F9D8', '#C5F6FA', '#D0EBFF', '#E5DBFF', '#FFE3E3'] as const

export function getCellBackgroundColor(row: RowData, column: ColumnDef): string | undefined {
  return row.cellBackgroundColors?.[column.id] ?? row.backgroundColor ?? column.backgroundColor
}

export function toExcelFillColor(color: string): string {
  return `FF${color.slice(1)}`
}
