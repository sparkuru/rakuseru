import { describe, expect, it } from 'vitest'

import { createSheetDocument } from './document'
import {
  createDefaultLibrarySnapshot,
  createDocumentLibrarySnapshot,
  createLibraryDocumentRecord,
  createStoredLibraryIndex,
  duplicateLibraryDocumentRecord,
  updateLibraryDocumentRecord,
  validateLibraryDocumentRecord,
  validateStoredLibraryIndex,
} from './library'

describe('document library model', () => {
  it('creates a default snapshot with one active document', () => {
    const snapshot = createDefaultLibrarySnapshot('2026-07-10T00:00:00.000Z')

    expect(snapshot.version).toBe(1)
    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.summaries).toHaveLength(1)
    expect(snapshot.activeDocumentId).toBe(snapshot.records[0].id)
  })

  it('uses a valid fallback active document when the requested active id is missing', () => {
    const first = createLibraryDocumentRecord(createSheetDocument('A'))
    const second = createLibraryDocumentRecord(createSheetDocument('B'))
    const snapshot = createDocumentLibrarySnapshot([first, second], 'missing')

    expect(snapshot.activeDocumentId).toBe(first.id)
  })

  it('duplicates records with a separate id and independent document copy', () => {
    const original = createLibraryDocumentRecord(createSheetDocument('采购清单'))
    const duplicate = duplicateLibraryDocumentRecord(original, '2026-07-10T00:00:00.000Z')

    duplicate.document.title = 'Edited'

    expect(duplicate.id).not.toBe(original.id)
    expect(duplicate.title).toBe('采购清单 副本')
    expect(original.document.title).toBe('采购清单')
  })

  it('updates record metadata from the canonical document title', () => {
    const record = createLibraryDocumentRecord(createSheetDocument('Old'), '2026-07-10T00:00:00.000Z')
    const nextDocument = { ...record.document, title: 'New' }
    const next = updateLibraryDocumentRecord(record, nextDocument, '2026-07-10T01:00:00.000Z')

    expect(next.title).toBe('New')
    expect(next.document.title).toBe('New')
    expect(next.createdAt).toBe(record.createdAt)
    expect(next.updatedAt).toBe('2026-07-10T01:00:00.000Z')
  })

  it('validates stored records through the sheet document validator', () => {
    const record = createLibraryDocumentRecord(createSheetDocument('Stored'))
    const valid = validateLibraryDocumentRecord(record)
    const invalid = validateLibraryDocumentRecord({ ...record, document: { version: 2 } })

    expect(valid?.document.title).toBe('Stored')
    expect(invalid).toBeUndefined()
  })

  it('creates a compact stored index from summaries', () => {
    const first = createLibraryDocumentRecord(createSheetDocument('A'))
    const second = createLibraryDocumentRecord(createSheetDocument('B'))
    const snapshot = createDocumentLibrarySnapshot([first, second], second.id)
    const index = createStoredLibraryIndex(snapshot)

    expect(index).toEqual({
      version: 1,
      activeDocumentId: second.id,
      order: [first.id, second.id],
    })
    expect(validateStoredLibraryIndex(index)).toEqual(index)
  })
})
