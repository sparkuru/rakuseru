import ExcelJS from 'exceljs'
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

  it('applies resolved background colors to header and data cells', async () => {
    const document: SheetDocument = {
      version: 1,
      title: 'Colors',
      columns: [{ id: 'item', title: 'Item', type: 'text', backgroundColor: '#D0EBFF' }],
      rows: [{ id: 'row_1', backgroundColor: '#D3F9D8', cellBackgroundColors: { item: '#FFF3BF' }, cells: { item: 'Paper' } }],
    }
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await (await exportXlsxBlob(document)).arrayBuffer())
    const worksheet = workbook.worksheets[0]

    expect(worksheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFD0EBFF' } })
    expect(worksheet.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFFFF3BF' } })
  })
})
