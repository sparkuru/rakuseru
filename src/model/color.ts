import type { ColumnDef, RowData } from './document'

export const BACKGROUND_COLOR_PRESETS = ['#FFF3BF', '#D3F9D8', '#C5F6FA', '#D0EBFF', '#E5DBFF', '#FFE3E3'] as const

export function normalizeBackgroundColor(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) {
    return undefined
  }

  const hex = match[1].toUpperCase()
  return hex.length === 3 ? `#${hex.split('').map((character) => `${character}${character}`).join('')}` : `#${hex}`
}

export function getCellBackgroundColor(row: RowData, column: ColumnDef): string | undefined {
  return row.cellBackgroundColors?.[column.id] ?? row.backgroundColor ?? column.backgroundColor
}

export function toExcelFillColor(color: string): string {
  return `FF${color.slice(1)}`
}
