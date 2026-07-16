import { describe, expect, it } from 'vitest'

import type { SheetDocument } from '../model/document'
import { exportCsv } from './exportCsv'
import { exportJson } from './exportJson'
import { exportMarkdown } from './exportMarkdown'

const document: SheetDocument = {
  version: 1,
  title: 'Procurement | Sheet',
  columns: [
    { id: 'item', title: 'Item', type: 'text' },
    { id: 'notes', title: 'Notes | Details', type: 'text' },
    { id: 'tags', title: 'Tags', type: 'multiSelect' },
  ],
  rows: [
    {
      id: 'row_1',
      cells: {
        item: 'Desk',
        notes: 'Needs "wide", stable top',
        tags: ['office', 'urgent'],
      },
    },
    {
      id: 'row_2',
      cells: {
        item: 'Lamp',
        notes: 'Line one\nLine two | marked',
        tags: [],
      },
    },
  ],
}

describe('export adapters', () => {
  it('exports formatted JSON', () => {
    expect(exportJson(document)).toBe(JSON.stringify(document, null, 2))
  })

  it('escapes CSV cells containing quotes, commas, or newlines', () => {
    expect(exportCsv(document)).toBe(
      [
        'Item,Notes | Details,Tags',
        'Desk,"Needs ""wide"", stable top","office, urgent"',
        'Lamp,"Line one\nLine two | marked",',
      ].join('\n'),
    )
  })

  it('escapes Markdown table pipes and newlines', () => {
    expect(exportMarkdown(document)).toBe(
      [
        '# Procurement | Sheet',
        '',
        '| Item | Notes \\| Details | Tags |',
        '| --- | --- | --- |',
        '| Desk | Needs "wide", stable top | office, urgent |',
        '| Lamp | Line one<br>Line two \\| marked |  |',
        '',
      ].join('\n'),
    )
  })

  it('keeps image names as text in CSV and Markdown', () => {
    const imageDocument: SheetDocument = {
      version: 1,
      title: 'Image export',
      columns: [{ id: 'image', title: 'Image', type: 'image' }],
      rows: [
        {
          id: 'row_1',
          cells: {
            image: { kind: 'image', name: 'desk.png', mime: 'image/png', dataUrl: 'data:image/png;base64,AA==', fit: 'contain' },
          },
        },
      ],
    }

    expect(exportMarkdown(imageDocument)).toContain('| desk.png |')
    expect(exportCsv(imageDocument)).toBe('Image\ndesk.png')
  })
})
