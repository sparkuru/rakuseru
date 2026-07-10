import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSheetDocument } from '../model/document'
import { createDocumentLibrarySnapshot, createLibraryDocumentRecord } from '../model/library'
import { loadDocumentLibrary, saveActiveLibraryDocument, saveDocumentLibrary } from '../storage/indexedDb'
import { useSheetStore } from './sheetStore'

vi.mock('../storage/indexedDb', () => ({
  loadDocumentLibrary: vi.fn(),
  saveActiveLibraryDocument: vi.fn(async () => undefined),
  saveDocumentLibrary: vi.fn(async () => undefined),
}))

describe('sheetStore document library actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const first = createLibraryDocumentRecord(createSheetDocument('First'), '2026-07-10T00:00:00.000Z')
    const second = createLibraryDocumentRecord(createSheetDocument('Second'), '2026-07-10T00:00:00.000Z')
    const snapshot = createDocumentLibrarySnapshot([first, second], first.id)

    vi.mocked(loadDocumentLibrary).mockResolvedValue(snapshot)
    useSheetStore.setState({
      documents: snapshot.summaries,
      activeDocumentId: snapshot.activeDocumentId,
      libraryRecords: snapshot.records,
      document: first.document,
      selectedColumnId: first.document.columns[0]?.id,
      activeRowId: first.document.rows[0]?.id,
      activeCell: undefined,
      rightPanelMode: { kind: 'empty' },
      sidePanelCollapsed: false,
      status: 'idle',
      message: '',
    })
  })

  it('switches active documents after saving the current sheet', async () => {
    const target = useSheetStore.getState().documents.find((summary) => summary.title === 'Second')!

    await useSheetStore.getState().switchDocument(target.id)

    expect(saveActiveLibraryDocument).toHaveBeenCalled()
    expect(useSheetStore.getState().activeDocumentId).toBe(target.id)
    expect(useSheetStore.getState().document.title).toBe('Second')
  })

  it('duplicates the active document as an independently editable sheet', () => {
    useSheetStore.getState().duplicateDocument()
    const duplicateId = useSheetStore.getState().activeDocumentId

    useSheetStore.getState().setTitle('Edited duplicate')

    const state = useSheetStore.getState()
    const original = state.libraryRecords.find((record) => record.title === 'First')
    const duplicate = state.libraryRecords.find((record) => record.id === duplicateId)

    expect(saveDocumentLibrary).toHaveBeenCalled()
    expect(duplicateId).not.toBe(original?.id)
    expect(original?.document.title).toBe('First')
    expect(duplicate?.document.title).toBe('Edited duplicate')
  })

  it('deletes the active document and falls back to a remaining sheet', () => {
    const deletedId = useSheetStore.getState().activeDocumentId

    useSheetStore.getState().deleteDocument(deletedId)

    expect(useSheetStore.getState().activeDocumentId).not.toBe(deletedId)
    expect(useSheetStore.getState().document.title).toBe('Second')
    expect(useSheetStore.getState().documents).toHaveLength(1)
  })

  it('imports a validated document as a new active sheet', () => {
    useSheetStore.getState().importDocumentAsNew(createSheetDocument('Imported'), 'Imported file')

    expect(useSheetStore.getState().document.title).toBe('Imported')
    expect(useSheetStore.getState().documents.map((summary) => summary.title)).toContain('Imported')
    expect(saveDocumentLibrary).toHaveBeenCalled()
  })
})
