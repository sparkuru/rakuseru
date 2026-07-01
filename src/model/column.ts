import { createId } from '../utils/ids'
import { coerceCellValue, createEmptyCellValue } from './cell'
import type { ColumnDef, ColumnType, RowData, SheetDocument } from './document'

export const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'money', 'singleSelect', 'multiSelect', 'image', 'link']

export function createColumn(title: string, type: ColumnType = 'text'): ColumnDef {
  return {
    id: createId('col'),
    title,
    type,
    width: type === 'image' ? 180 : 160,
    wrap: type === 'text' || type === 'link',
    options: type === 'singleSelect' || type === 'multiSelect' ? ['待确认', '已采购', '不采购'] : undefined,
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

export function updateColumn(document: SheetDocument, columnId: string, patch: Partial<ColumnDef>): SheetDocument {
  const nextColumns = document.columns.map((column) => (column.id === columnId ? { ...column, ...patch, id: column.id } : column))
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

function coerceRowCell(row: RowData, column: ColumnDef): RowData {
  return {
    ...row,
    cells: {
      ...row.cells,
      [column.id]: coerceCellValue(column, row.cells[column.id] ?? createEmptyCellValue(column)),
    },
  }
}
