import { describe, expect, it } from 'vitest'

import { addColumn, createColumn, updateColumn } from './column'
import { createSheetDocument } from './document'
import { addRow, removeRow, updateCell } from './row'
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

  it('adds a column and initializes row cells', () => {
    const document = createSheetDocument()
    const column = createColumn('备注', 'text')
    const next = addColumn(document, column)

    expect(next.columns.at(-1)).toEqual(column)
    expect(next.rows.every((row) => row.cells[column.id] === '')).toBe(true)
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

  it('rejects invalid imports', () => {
    const result = validateSheetDocument({ version: 2, title: '', columns: [], rows: 'nope' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })
})
