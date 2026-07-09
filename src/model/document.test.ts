import { describe, expect, it } from 'vitest'

import { addColumn, createColumn, moveColumn, moveColumnToIndex, updateColumn } from './column'
import { createSheetDocument } from './document'
import { addRow, moveRow, moveRowToIndex, removeRow, updateCell } from './row'
import { validateSheetDocument } from './validation'

describe('SheetDocument model', () => {
  it('creates a usable sample document', () => {
    const document = createSheetDocument()

    expect(document.version).toBe(1)
    expect(document.columns.length).toBeGreaterThan(0)
    expect(document.rows.length).toBeGreaterThan(0)
  })

  it('adds and removes rows', () => {
    const document = createSheetDocument()
    const added = addRow(document)
    const removed = removeRow(added, added.rows[0].id)

    expect(added.rows).toHaveLength(document.rows.length + 1)
    expect(removed.rows).toHaveLength(document.rows.length)
  })

  it('moves rows by swapping with the adjacent row', () => {
    const document = createSheetDocument()
    const targetRow = document.rows[1]
    const movedUp = moveRow(document, targetRow.id, -1)
    const movedPastStart = moveRow(movedUp, targetRow.id, -1)

    expect(movedUp.rows[0].id).toBe(targetRow.id)
    expect(movedPastStart).toBe(movedUp)
  })

  it('moves rows to a target index for drag reordering', () => {
    const document = addRow(createSheetDocument())
    const targetRow = document.rows[0]
    const moved = moveRowToIndex(document, targetRow.id, 2)
    const outOfRange = moveRowToIndex(moved, targetRow.id, 99)

    expect(moved.rows[2].id).toBe(targetRow.id)
    expect(outOfRange.rows.at(-1)?.id).toBe(targetRow.id)
  })

  it('adds a column and initializes row cells', () => {
    const document = createSheetDocument()
    const column = createColumn('备注', 'text')
    const next = addColumn(document, column)

    expect(next.columns.at(-1)).toEqual(column)
    expect(next.rows.every((row) => row.cells[column.id] === '')).toBe(true)
  })

  it('moves columns by swapping with the adjacent column', () => {
    const document = createSheetDocument()
    const targetColumn = document.columns[1]
    const movedLeft = moveColumn(document, targetColumn.id, -1)
    const movedPastStart = moveColumn(movedLeft, targetColumn.id, -1)

    expect(movedLeft.columns[0].id).toBe(targetColumn.id)
    expect(movedPastStart).toBe(movedLeft)
  })

  it('moves columns to a target index for drag reordering', () => {
    const document = createSheetDocument()
    const targetColumn = document.columns[0]
    const moved = moveColumnToIndex(document, targetColumn.id, 3)
    const outOfRange = moveColumnToIndex(moved, targetColumn.id, 99)

    expect(moved.columns[3].id).toBe(targetColumn.id)
    expect(outOfRange.columns.at(-1)?.id).toBe(targetColumn.id)
  })

  it('coerces cell values by column type', () => {
    const document = createSheetDocument()
    const moneyColumn = document.columns.find((column) => column.type === 'money')

    expect(moneyColumn).toBeDefined()

    const next = updateCell(document, document.rows[0].id, moneyColumn!.id, '$1,250')

    expect(next.rows[0].cells[moneyColumn!.id]).toBe(1250)
  })

  it('coerces existing cells when a column type changes', () => {
    const document = createSheetDocument()
    const textColumn = document.columns.find((column) => column.type === 'text')!
    const edited = updateCell(document, document.rows[0].id, textColumn.id, '42')
    const next = updateColumn(edited, textColumn.id, { type: 'number' })

    expect(next.rows[0].cells[textColumn.id]).toBe(42)
  })

  it('adds default options when switching a column to select', () => {
    const document = createSheetDocument()
    const textColumn = document.columns.find((column) => column.type === 'text')!
    const next = updateColumn(document, textColumn.id, { type: 'singleSelect' })
    const nextColumn = next.columns.find((column) => column.id === textColumn.id)!

    expect(nextColumn.options).toEqual(['待确认', '已采购', '不采购'])
  })

  it('removes options when switching away from select', () => {
    const document = createSheetDocument()
    const selectColumn = document.columns.find((column) => column.type === 'singleSelect')!
    const next = updateColumn(document, selectColumn.id, { type: 'text' })
    const nextColumn = next.columns.find((column) => column.id === selectColumn.id)!

    expect(nextColumn.options).toBeUndefined()
  })

  it('accepts compatible image display metadata', () => {
    const document = createSheetDocument()
    const imageColumn = document.columns.find((column) => column.type === 'image')!
    const input = updateCell(document, document.rows[0].id, imageColumn.id, {
      kind: 'image',
      name: 'sample.png',
      mime: 'image/png',
      dataUrl: 'data:image/png;base64,abc',
      fit: 'contain',
    })
    const result = validateSheetDocument(input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rows[0].cells[imageColumn.id]).toEqual(input.rows[0].cells[imageColumn.id])
    }
  })

  it('rejects invalid imports', () => {
    const result = validateSheetDocument({ version: 2, title: '', columns: [], rows: 'nope' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })
})
