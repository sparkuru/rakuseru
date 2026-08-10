import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  COLUMN_TYPES,
  isImageValue,
  validateSheetDocument,
} from '../src/index.js'

const testDirectory = dirname(fileURLToPath(import.meta.url))

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(testDirectory, 'fixtures', name), 'utf8')) as unknown
}

function readTypeScriptSources(directory: string): string {
  return readdirSync(directory)
    .map((name) => join(directory, name))
    .flatMap((path) => statSync(path).isDirectory() ? [readTypeScriptSources(path)] : extname(path) === '.ts' ? [readFileSync(path, 'utf8')] : [])
    .join('\n')
}

describe('version-1 SheetDocument compatibility', () => {
  it('accepts every current cell kind and preserves inline images', () => {
    const input = readFixture('version-1-all-cells.json')
    const result = validateSheetDocument(input)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.columns.map((column) => column.type)).toEqual(COLUMN_TYPES)
    expect(result.value.rows[0].cells).toMatchObject({
      text: '显示器',
      number: 2,
      money: 2499.5,
      single: '待办',
      multi: ['采购', '紧急'],
      link: 'https://example.test/monitor',
    })

    const image = result.value.rows[0].cells.image
    expect(isImageValue(image)).toBe(true)
    expect(image).toEqual({
      kind: 'image',
      name: 'monitor.png',
      mime: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      fit: 'contain',
    })
  })

  it('round-trips the canonical JSON shape without changing validated data', () => {
    const first = validateSheetDocument(readFixture('version-1-all-cells.json'))
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }

    const second = validateSheetDocument(JSON.parse(JSON.stringify(first.value)) as unknown)
    expect(second).toEqual(first)
  })

  it.each([
    {
      name: 'wrong version',
      input: { version: 2, title: 'Invalid', columns: [{ id: 'a', title: 'A', type: 'text' }], rows: [] },
      error: 'Document version must be 1.',
    },
    {
      name: 'duplicate column ids',
      input: {
        version: 1,
        title: 'Invalid',
        columns: [
          { id: 'same', title: 'A', type: 'text' },
          { id: 'same', title: 'B', type: 'number' },
        ],
        rows: [],
      },
      error: 'Column ids must be unique.',
    },
    {
      name: 'unsupported column type',
      input: { version: 1, title: 'Invalid', columns: [{ id: 'a', title: 'A', type: 'video' }], rows: [] },
      error: 'Column 1 has an unsupported type.',
    },
    {
      name: 'non-array rows',
      input: { version: 1, title: 'Invalid', columns: [{ id: 'a', title: 'A', type: 'text' }], rows: {} },
      error: 'Rows must be an array.',
    },
  ])('rejects $name documents with the established error', ({ input, error }) => {
    const result = validateSheetDocument(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain(error)
    }
  })

  it('keeps existing coercion behavior for invalid optional metadata and cell values', () => {
    const input = readFixture('version-1-all-cells.json') as {
      columns: Array<Record<string, unknown>>
      rows: Array<{ cells: Record<string, unknown> }>
    }
    input.columns[0].align = 'diagonal'
    input.columns[0].backgroundColor = 'not-a-color'
    input.rows[0].cells.number = '$1,250'
    input.rows[0].cells.image = { kind: 'image', name: 'broken' }

    const result = validateSheetDocument(input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.columns[0].align).toBeUndefined()
      expect(result.value.columns[0].backgroundColor).toBeUndefined()
      expect(result.value.rows[0].cells.number).toBe(1250)
      expect(result.value.rows[0].cells.image).toBe('')
    }
  })
})

describe('portable package boundary', () => {
  it('has no browser, frontend framework, persistence, API, or database imports', () => {
    const sourceDirectory = join(testDirectory, '..', 'src')
    const source = readTypeScriptSources(sourceDirectory)

    expect(source).not.toMatch(/(?:from|import\s*\()[\s(]*['"](?:react|zustand|idb|@elysia|kysely|mysql2|mariadb|prisma|node:)/)
    expect(source).not.toMatch(/\b(?:window|indexedDB|localStorage|sessionStorage)\b/)
    expect(source).not.toMatch(/(?:^|\/)apps\/api|(?:^|\/)src\/(?:components|state|storage|adapters|utils)\//)
  })
})
