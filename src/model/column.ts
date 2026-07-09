import { createId } from '../utils/ids'
import { coerceCellValue, createEmptyCellValue } from './cell'
import type { ColumnDef, ColumnType, RowData, SheetDocument } from './document'

export const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'money', 'singleSelect', 'multiSelect', 'image', 'link']
export const DEFAULT_SELECT_OPTIONS = ['待确认', '已采购', '不采购']
export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: '文本',
  number: '数字',
  money: '金额',
  singleSelect: '单选',
  multiSelect: '多选',
  image: '图片',
  link: '链接',
}

export function createColumn(title: string, type: ColumnType = 'text'): ColumnDef {
  return {
    id: createId('col'),
    title,
    type,
    width: type === 'image' ? 180 : 160,
    wrap: type === 'text' || type === 'link',
    options: isSelectType(type) ? DEFAULT_SELECT_OPTIONS : undefined,
  }
}

export function addColumn(document: SheetDocument, column: ColumnDef): SheetDocument {
  return {
    ...document,
    columns: [...document.columns, column],
    rows: document.rows.map((row) => ({
      ...row,
      cells: {
        ...row.cells,
        [column.id]: createEmptyCellValue(column),
      },
    })),
  }
}

export function removeColumn(document: SheetDocument, columnId: string): SheetDocument {
  return {
    ...document,
    columns: document.columns.filter((column) => column.id !== columnId),
    rows: document.rows.map((row) => {
      const cells = { ...row.cells }
      delete cells[columnId]
      return { ...row, cells }
    }),
  }
}

export function moveColumn(document: SheetDocument, columnId: string, direction: -1 | 1): SheetDocument {
  const index = document.columns.findIndex((column) => column.id === columnId)
  const nextIndex = index + direction

  if (index < 0 || nextIndex < 0 || nextIndex >= document.columns.length) {
    return document
  }

  const columns = [...document.columns]
  ;[columns[index], columns[nextIndex]] = [columns[nextIndex], columns[index]]

  return {
    ...document,
    columns,
  }
}

export function moveColumnToIndex(document: SheetDocument, columnId: string, targetIndex: number): SheetDocument {
  const index = document.columns.findIndex((column) => column.id === columnId)
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, document.columns.length - 1))

  if (index < 0 || index === boundedTargetIndex) {
    return document
  }

  const columns = [...document.columns]
  const [column] = columns.splice(index, 1)
  columns.splice(boundedTargetIndex, 0, column)

  return {
    ...document,
    columns,
  }
}

export function updateColumn(document: SheetDocument, columnId: string, patch: Partial<ColumnDef>): SheetDocument {
  const nextColumns = document.columns.map((column) => (column.id === columnId ? normalizeColumnForType({ ...column, ...patch, id: column.id }, patch) : column))
  const nextColumn = nextColumns.find((column) => column.id === columnId)

  if (!nextColumn) {
    return document
  }

  return {
    ...document,
    columns: nextColumns,
    rows: document.rows.map((row) => coerceRowCell(row, nextColumn)),
  }
}

function normalizeColumnForType(column: ColumnDef, patch: Partial<ColumnDef>): ColumnDef {
  if (!isSelectType(column.type)) {
    return {
      id: column.id,
      title: column.title,
      type: column.type,
      width: column.width,
      lockedWidth: column.lockedWidth,
      wrap: column.wrap,
      required: column.required,
    }
  }

  if ('options' in patch) {
    return { ...column, options: normalizeOptions(patch.options ?? []) }
  }

  return {
    ...column,
    options: normalizeOptions(column.options?.length ? column.options : DEFAULT_SELECT_OPTIONS),
  }
}

function normalizeOptions(options: string[]): string[] {
  return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)))
}

function isSelectType(type: ColumnType): boolean {
  return type === 'singleSelect' || type === 'multiSelect'
}

function coerceRowCell(row: RowData, column: ColumnDef): RowData {
  return {
    ...row,
    cells: {
      ...row.cells,
      [column.id]: coerceCellValue(column, row.cells[column.id] ?? createEmptyCellValue(column)),
    },
  }
}
