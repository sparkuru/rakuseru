import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { documentHasImages } from '../model/cell'
import type { SheetDocument } from '../model/document'
import { exportJsonZipBlob, importJsonZip } from './jsonZip'

const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9ZQAAAABJRU5ErkJggg=='

const document: SheetDocument = {
  version: 1,
  title: 'Archive / sheet',
  columns: [
    { id: 'item', title: 'Item', type: 'text' },
    { id: 'first-image', title: 'First image', type: 'image' },
    { id: 'second-image', title: 'Second image', type: 'image' },
  ],
  rows: [
    {
      id: 'row_1',
      cells: {
        item: 'Desk',
        'first-image': { kind: 'image', name: 'desk.png', mime: 'image/png', dataUrl: imageDataUrl, fit: 'contain' },
        'second-image': { kind: 'image', name: 'duplicate.png', mime: 'image/png', dataUrl: imageDataUrl, fit: 'cover' },
      },
    },
  ],
}

describe('JSON ZIP export and import', () => {
  it('archives one manifest and deduplicated image files, then round-trips the document', async () => {
    const archive = await exportJsonZipBlob(document)
    const zip = await JSZip.loadAsync(await archive.arrayBuffer())
    const manifestName = Object.keys(zip.files).find((name) => name.endsWith('.json'))

    expect(documentHasImages(document)).toBe(true)
    expect(manifestName).toBe('Archive - sheet.json')
    expect(Object.keys(zip.files).filter((name) => name.startsWith('img/'))).toEqual(['img/', 'img/image-1.png'])
    expect(await importJsonZip(await archive.arrayBuffer())).toEqual(document)
  })

  it('rejects a ZIP that does not carry the Rakuseru manifest contract', async () => {
    const zip = new JSZip()
    zip.file('sheet.json', JSON.stringify({ version: 1 }))

    await expect(importJsonZip(await (await zip.generateAsync({ type: 'blob' })).arrayBuffer())).rejects.toThrow('not a Rakuseru JSON image archive')
  })
})
