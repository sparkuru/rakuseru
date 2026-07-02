import { describe, expect, it } from 'vitest'

import { createSheetDocument } from '../model/document'
import { exportJson } from './exportJson'
import { importJson } from './importJson'

describe('importJson', () => {
  it('imports an exported document', () => {
    const document = createSheetDocument('Importable sheet')

    expect(importJson(exportJson(document))).toEqual(document)
  })

  it('throws a user-readable error for malformed JSON', () => {
    expect(() => importJson('{ nope')).toThrow(/Invalid JSON:/)
  })

  it.each([
    ['wrong document version', { version: 2, title: 'Sheet', columns: [{ id: 'item', title: 'Item', type: 'text' }], rows: [] }, 'Document version must be 1.'],
    ['empty title', { version: 1, title: '', columns: [{ id: 'item', title: 'Item', type: 'text' }], rows: [] }, 'Document title is required.'],
    ['missing columns', { version: 1, title: 'Sheet', rows: [] }, 'Document must include at least one column.'],
    [
      'duplicate column ids',
      {
        version: 1,
        title: 'Sheet',
        columns: [
          { id: 'item', title: 'Item', type: 'text' },
          { id: 'item', title: 'Duplicate', type: 'text' },
        ],
        rows: [],
      },
      'Column ids must be unique.',
    ],
    ['non-array rows', { version: 1, title: 'Sheet', columns: [{ id: 'item', title: 'Item', type: 'text' }], rows: 'nope' }, 'Rows must be an array.'],
    ['unsupported column type', { version: 1, title: 'Sheet', columns: [{ id: 'item', title: 'Item', type: 'unknown' }], rows: [] }, 'Column 1 has an unsupported type.'],
  ])('throws a user-readable validation error for %s', (_label, input, message) => {
    expect(() => importJson(JSON.stringify(input))).toThrow(message)
  })

  it('does not report duplicate ids from synthetic invalid column ids', () => {
    const input = {
      version: 1,
      title: 'Sheet',
      columns: [null, { id: 'invalid-0', title: 'Looks colliding', type: 'text' }],
      rows: [],
    }

    expect(() => importJson(JSON.stringify(input))).toThrow('Column 1 must be an object.')
    expect(() => importJson(JSON.stringify(input))).not.toThrow('Column ids must be unique.')
  })
})
