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
