import { coerceCellValue, createEmptyCellValue, isImageValue } from './cell.js'
import { normalizeBackgroundColor } from './color.js'
import { COLUMN_ALIGNMENTS, COLUMN_TYPES, SHEET_DOCUMENT_VERSION } from './contract.js'
import type { CellValue, ColumnAlign, ColumnDef, RowData, SheetDocument } from './contract.js'

export type ValidationResult<T> = {
  ok: true
  value: T
} | {
  ok: false
  errors: string[]
}

export function validateSheetDocument(input: unknown): ValidationResult<SheetDocument> {
  const errors: string[] = []

  if (!isRecord(input)) {
    return { ok: false, errors: ['Document must be an object.'] }
  }

  if (input.version !== SHEET_DOCUMENT_VERSION) {
    errors.push('Document version must be 1.')
  }

  if (typeof input.title !== 'string' || input.title.trim() === '') {
    errors.push('Document title is required.')
  }

  const columns = Array.isArray(input.columns) ? input.columns.map((column, index) => normalizeColumn(column, index, errors)) : []
  if (!Array.isArray(input.columns) || columns.length === 0) {
    errors.push('Document must include at least one column.')
  }

  const realColumnIds = Array.isArray(input.columns) ? input.columns.flatMap(readValidColumnId) : []
  const columnIds = new Set(realColumnIds)
  if (columnIds.size !== realColumnIds.length) {
    errors.push('Column ids must be unique.')
  }

  const rows = Array.isArray(input.rows) ? input.rows.map((row, index) => normalizeRow(row, index, columns, errors)) : []
  if (!Array.isArray(input.rows)) {
    errors.push('Rows must be an array.')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      version: SHEET_DOCUMENT_VERSION,
      title: input.title as string,
      columns,
      rows,
    },
  }
}

function normalizeColumn(input: unknown, index: number, errors: string[]): ColumnDef {
  if (!isRecord(input)) {
    errors.push(`Column ${index + 1} must be an object.`)
    return { id: `invalid-${index}`, title: '', type: 'text' }
  }

  const type = typeof input.type === 'string' && COLUMN_TYPES.includes(input.type as ColumnDef['type']) ? input.type as ColumnDef['type'] : 'text'

  if (typeof input.id !== 'string' || input.id.trim() === '') {
    errors.push(`Column ${index + 1} needs an id.`)
  }

  if (typeof input.title !== 'string' || input.title.trim() === '') {
    errors.push(`Column ${index + 1} needs a title.`)
  }

  if (input.type !== type) {
    errors.push(`Column ${index + 1} has an unsupported type.`)
  }

  return {
    id: typeof input.id === 'string' ? input.id : `invalid-${index}`,
    title: typeof input.title === 'string' ? input.title : '',
    type,
    width: readOptionalNumber(input.width),
    lockedWidth: readOptionalBoolean(input.lockedWidth),
    wrap: readOptionalBoolean(input.wrap),
    align: readOptionalAlignment(input.align),
    options: readOptionalStringArray(input.options),
    required: readOptionalBoolean(input.required),
    backgroundColor: normalizeBackgroundColor(input.backgroundColor),
  }
}

function readValidColumnId(input: unknown): string[] {
  if (!isRecord(input) || typeof input.id !== 'string' || input.id.trim() === '') {
    return []
  }

  return [input.id]
}

function normalizeRow(input: unknown, index: number, columns: ColumnDef[], errors: string[]): RowData {
  if (!isRecord(input)) {
    errors.push(`Row ${index + 1} must be an object.`)
    return { id: `invalid-${index}`, cells: {} }
  }

  if (typeof input.id !== 'string' || input.id.trim() === '') {
    errors.push(`Row ${index + 1} needs an id.`)
  }

  const rawCells = isRecord(input.cells) ? input.cells : {}
  if (!isRecord(input.cells)) {
    errors.push(`Row ${index + 1} cells must be an object.`)
  }

  const cells: Record<string, CellValue> = {}
  for (const column of columns) {
    cells[column.id] = coerceCellValue(column, readCellValue(rawCells[column.id]) ?? createEmptyCellValue(column))
  }

  return {
    id: typeof input.id === 'string' ? input.id : `invalid-${index}`,
    height: readOptionalNumber(input.height),
    lockedHeight: readOptionalBoolean(input.lockedHeight),
    backgroundColor: normalizeBackgroundColor(input.backgroundColor),
    cellBackgroundColors: normalizeCellBackgroundColors(input.cellBackgroundColors, columns),
    cells,
  }
}

function normalizeCellBackgroundColors(input: unknown, columns: ColumnDef[]): Record<string, string> | undefined {
  if (!isRecord(input)) {
    return undefined
  }

  const allowedIds = new Set(columns.map((column) => column.id))
  const colors = Object.fromEntries(Object.entries(input)
    .filter(([columnId]) => allowedIds.has(columnId))
    .flatMap(([columnId, color]) => {
      const normalizedColor = normalizeBackgroundColor(color)
      return normalizedColor ? [[columnId, normalizedColor]] : []
    }))

  return Object.keys(colors).length > 0 ? colors : undefined
}

function readCellValue(input: unknown): CellValue | undefined {
  if (typeof input === 'string' || typeof input === 'number') {
    return input
  }

  if (Array.isArray(input) && input.every((item) => typeof item === 'string')) {
    return input
  }

  if (isImageValue(input)) {
    return input
  }

  return undefined
}

function readOptionalNumber(input: unknown): number | undefined {
  return typeof input === 'number' && Number.isFinite(input) ? input : undefined
}

function readOptionalBoolean(input: unknown): boolean | undefined {
  return typeof input === 'boolean' ? input : undefined
}

function readOptionalAlignment(input: unknown): ColumnAlign | undefined {
  return typeof input === 'string' && COLUMN_ALIGNMENTS.includes(input as ColumnAlign) ? input as ColumnAlign : undefined
}

function readOptionalStringArray(input: unknown): string[] | undefined {
  return Array.isArray(input) && input.every((item) => typeof item === 'string') ? input : undefined
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
