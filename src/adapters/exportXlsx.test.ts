import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import type { SheetDocument } from '../model/document'
import { exportXlsxBlob } from './exportXlsx'

describe('XLSX export', () => {
  it('embeds supported image cells in the workbook archive', async () => {
    const document: SheetDocument = {
      version: 1,
      title: 'Image workbook',
      columns: [{ id: 'image', title: 'Image', type: 'image', width: 180 }],
      rows: [
        {
          id: 'row_1',
          cells: {
            image: {
              kind: 'image',
              name: 'pixel.png',
              mime: 'image/png',
              dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9ZQAAAABJRU5ErkJggg==',
            },
          },
        },
      ],
    }

    const workbook = await JSZip.loadAsync(await (await exportXlsxBlob(document)).arrayBuffer())

    expect(workbook.file('xl/media/image1.png')).toBeDefined()
  })
})
