import { coerceCellValue, createEmptyCellValue } from './cell'
import { createRow } from './document'
import type { CellValue, SheetDocument } from './document'

export function addRow(document: SheetDocument): SheetDocument {
  return {
    ...document,
    rows: [...document.rows, createRow(document.columns)],
  }
}

export function removeRow(document: SheetDocument, rowId: string): SheetDocument {
  return {
    ...document,
    rows: document.rows.filter((row) => row.id !== rowId),
  }
}

export function moveRow(document: SheetDocument, rowId: string, direction: -1 | 1): SheetDocument {
  const index = document.rows.findIndex((row) => row.id === rowId)
  const nextIndex = index + direction

  if (index < 0 || nextIndex < 0 || nextIndex >= document.rows.length) {
    return document
  }

  const rows = [...document.rows]
  ;[rows[index], rows[nextIndex]] = [rows[nextIndex], rows[index]]

  return {
    ...document,
    rows,
  }
}

export function moveRowToIndex(document: SheetDocument, rowId: string, targetIndex: number): SheetDocument {
  const index = document.rows.findIndex((row) => row.id === rowId)
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, document.rows.length - 1))

  if (index < 0 || index === boundedTargetIndex) {
    return document
  }

  const rows = [...document.rows]
  const [row] = rows.splice(index, 1)
  rows.splice(boundedTargetIndex, 0, row)

  return {
    ...document,
    rows,
  }
}

export function updateCell(document: SheetDocument, rowId: string, columnId: string, value: CellValue): SheetDocument {
  const column = document.columns.find((candidate) => candidate.id === columnId)

  if (!column) {
    return document
  }

  return {
    ...document,
    rows: document.rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            cells: {
              ...row.cells,
              [columnId]: coerceCellValue(column, value ?? createEmptyCellValue(column)),
            },
          }
        : row,
    ),
  }
}
