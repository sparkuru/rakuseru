import { describe, expect, it } from 'vitest'

import { getCellBackgroundColor, normalizeBackgroundColor, toExcelFillColor } from './color'
import { removeColumn } from './column'
import type { SheetDocument } from './document'
import { validateSheetDocument } from './validation'

describe('background colors', () => {
  it('normalizes hex colors and resolves cell, row, then column precedence', () => {
    const column = { id: 'item', title: 'Item', type: 'text' as const, backgroundColor: '#D0EBFF' }
    const row = { id: 'row', backgroundColor: '#D3F9D8', cellBackgroundColors: { item: '#fff3bf' }, cells: { item: 'Paper' } }

    expect(normalizeBackgroundColor('#abc')).toBe('#AABBCC')
    expect(normalizeBackgroundColor('blue')).toBeUndefined()
    expect(getCellBackgroundColor(row, column)).toBe('#fff3bf')
    expect(getCellBackgroundColor({ ...row, cellBackgroundColors: undefined }, column)).toBe('#D3F9D8')
    expect(getCellBackgroundColor({ ...row, cellBackgroundColors: undefined, backgroundColor: undefined }, column)).toBe('#D0EBFF')
    expect(toExcelFillColor('#D0EBFF')).toBe('FFD0EBFF')
  })

  it('drops invalid imported colors and stale cell colors', () => {
    const validated = validateSheetDocument({
      version: 1,
      title: 'Colors',
      columns: [{ id: 'item', title: 'Item', type: 'text', backgroundColor: 'red' }],
      rows: [{ id: 'row', backgroundColor: '#abc', cellBackgroundColors: { item: '#def', missing: '#123456', other: 'bad' }, cells: { item: 'Paper' } }],
    })

    expect(validated).toMatchObject({ ok: true, value: { columns: [{ backgroundColor: undefined }], rows: [{ backgroundColor: '#AABBCC', cellBackgroundColors: { item: '#DDEEFF' } }] } })

    const document: SheetDocument = {
      version: 1,
      title: 'Colors',
      columns: [{ id: 'item', title: 'Item', type: 'text' }],
      rows: [{ id: 'row', cells: { item: 'Paper' }, cellBackgroundColors: { item: '#DDEEFF' } }],
    }
    expect(removeColumn(document, 'item').rows[0].cellBackgroundColors).toBeUndefined()
  })
})
