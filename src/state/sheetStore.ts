import { create } from 'zustand'

import { addColumn, createColumn, moveColumn, moveColumnToIndex, removeColumn, updateColumn } from '../model/column'
import { createSheetDocument } from '../model/document'
import type { CellValue, ColumnDef, ColumnType, SheetDocument } from '../model/document'
import {
  createDefaultLibrarySnapshot,
  createDocumentLibrarySnapshot,
  createLibraryDocumentRecord,
  duplicateLibraryDocumentRecord,
  type LibraryDocumentRecord,
  type LibraryDocumentSummary,
  updateLibraryDocumentRecord,
} from '../model/library'
import { addRow, moveRow, moveRowToIndex, removeRow, updateCell } from '../model/row'
import { loadDocumentLibrary, saveActiveLibraryDocument, saveDocumentLibrary } from '../storage/indexedDb'

type SheetStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type ActiveCell = {
  rowId: string
  columnId: string
}

export type RightPanelMode = {
  kind: 'empty'
} | {
  kind: 'column'
  columnId: string
} | {
  kind: 'cell'
  rowId: string
  columnId: string
}

type SheetStore = {
  documents: LibraryDocumentSummary[]
  activeDocumentId: string
  libraryRecords: LibraryDocumentRecord[]
  document: SheetDocument
  selectedColumnId?: string
  activeRowId?: string
  activeCell?: ActiveCell
  rightPanelMode: RightPanelMode
  sidePanelCollapsed: boolean
  status: SheetStatus
  message: string
  load: () => Promise<void>
  save: () => Promise<void>
  setDocument: (document: SheetDocument, message?: string) => void
  importDocumentAsNew: (document: SheetDocument, message?: string) => void
  replaceActiveDocument: (document: SheetDocument, message?: string) => void
  createDocument: () => void
  duplicateDocument: () => void
  switchDocument: (documentId: string) => Promise<void>
  deleteDocument: (documentId: string) => void
  setError: (message: string) => void
  setTitle: (title: string) => void
  addColumn: (type?: ColumnType) => void
  updateColumn: (columnId: string, patch: Partial<ColumnDef>) => void
  moveColumn: (columnId: string, direction: -1 | 1) => void
  moveColumnToIndex: (columnId: string, targetIndex: number) => void
  removeColumn: (columnId: string) => void
  addRow: () => void
  moveRow: (rowId: string, direction: -1 | 1) => void
  moveRowToIndex: (rowId: string, targetIndex: number) => void
  removeRow: (rowId: string) => void
  updateCell: (rowId: string, columnId: string, value: CellValue) => void
  selectRow: (rowId: string) => void
  selectCell: (rowId: string, columnId: string) => void
  selectColumn: (columnId: string) => void
  clearActivePanel: () => void
  toggleSidePanel: () => void
}

const initialLibrary = createDefaultLibrarySnapshot()

export const useSheetStore = create<SheetStore>((set, get) => ({
  documents: initialLibrary.summaries,
  activeDocumentId: initialLibrary.activeDocumentId,
  libraryRecords: initialLibrary.records,
  document: initialLibrary.records[0].document,
  selectedColumnId: undefined,
  activeRowId: undefined,
  activeCell: undefined,
  rightPanelMode: { kind: 'empty' },
  sidePanelCollapsed: false,
  status: 'idle',
  message: '',
  async load() {
    set({ status: 'loading', message: 'Loading saved sheets' })
    try {
      const snapshot = await loadDocumentLibrary()
      const activeRecord = readActiveRecord(snapshot.records, snapshot.activeDocumentId)
      set({
        documents: snapshot.summaries,
        activeDocumentId: activeRecord.id,
        libraryRecords: snapshot.records,
        document: activeRecord.document,
        selectedColumnId: activeRecord.document.columns[0]?.id,
        activeRowId: activeRecord.document.rows[0]?.id,
        activeCell: undefined,
        rightPanelMode: { kind: 'empty' },
        status: 'saved',
        message: snapshot.records.length > 1 ? `Loaded ${snapshot.records.length} sheets` : 'Loaded sheet library',
      })
    } catch (error) {
      set({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load sheets' })
    }
  },
  async save() {
    set({ status: 'saving', message: 'Saving' })
    try {
      const snapshot = createCurrentSnapshot(get())
      await saveActiveLibraryDocument(snapshot)
      set({ documents: snapshot.summaries, libraryRecords: snapshot.records, status: 'saved', message: 'Saved locally' })
    } catch (error) {
      set({ status: 'error', message: error instanceof Error ? error.message : 'Failed to save sheet' })
    }
  },
  setDocument(document, message = 'Document replaced') {
    get().replaceActiveDocument(document, message)
  },
  importDocumentAsNew(document, message = 'Imported as new sheet') {
    const currentSnapshot = createCurrentSnapshot(get())
    const record = createLibraryDocumentRecord(document)
    const snapshot = createDocumentLibrarySnapshot([...currentSnapshot.records, record], record.id)
    set({
      documents: snapshot.summaries,
      activeDocumentId: record.id,
      libraryRecords: snapshot.records,
      ...createEditorContext(record.document),
      status: 'idle',
      message,
    })
    persistLibrarySnapshot(snapshot, set)
  },
  replaceActiveDocument(document, message = 'Document replaced') {
    set((state) => {
      const snapshot = createCurrentSnapshot({ ...state, document })
      const activeRecord = readActiveRecord(snapshot.records, snapshot.activeDocumentId)

      return {
        documents: snapshot.summaries,
        libraryRecords: snapshot.records,
        ...createEditorContext(activeRecord.document),
        status: 'idle',
        message,
      }
    })
  },
  createDocument() {
    const currentSnapshot = createCurrentSnapshot(get())
    const record = createLibraryDocumentRecord(createSheetDocument())
    const snapshot = createDocumentLibrarySnapshot([...currentSnapshot.records, record], record.id)
    set({
      documents: snapshot.summaries,
      activeDocumentId: record.id,
      libraryRecords: snapshot.records,
      ...createEditorContext(record.document),
      status: 'idle',
      message: 'Sheet created',
    })
    persistLibrarySnapshot(snapshot, set)
  },
  duplicateDocument() {
    const currentSnapshot = createCurrentSnapshot(get())
    const activeRecord = readActiveRecord(currentSnapshot.records, currentSnapshot.activeDocumentId)
    const duplicate = duplicateLibraryDocumentRecord(activeRecord)
    const snapshot = createDocumentLibrarySnapshot([...currentSnapshot.records, duplicate], duplicate.id)
    set({
      documents: snapshot.summaries,
      activeDocumentId: duplicate.id,
      libraryRecords: snapshot.records,
      ...createEditorContext(duplicate.document),
      status: 'idle',
      message: 'Sheet duplicated',
    })
    persistLibrarySnapshot(snapshot, set)
  },
  async switchDocument(documentId) {
    const currentSnapshot = createCurrentSnapshot(get())
    const nextRecord = currentSnapshot.records.find((record) => record.id === documentId)

    if (!nextRecord || documentId === currentSnapshot.activeDocumentId) {
      return
    }

    try {
      await saveActiveLibraryDocument(currentSnapshot)
      set({
        documents: currentSnapshot.summaries,
        activeDocumentId: nextRecord.id,
        libraryRecords: currentSnapshot.records,
        ...createEditorContext(nextRecord.document),
        status: 'saved',
        message: `Opened ${nextRecord.title}`,
      })
      await saveActiveLibraryDocument(createDocumentLibrarySnapshot(currentSnapshot.records, nextRecord.id))
    } catch (error) {
      set({ status: 'error', message: error instanceof Error ? error.message : 'Failed to switch sheet' })
    }
  },
  deleteDocument(documentId) {
    const currentSnapshot = createCurrentSnapshot(get())
    const remainingRecords = currentSnapshot.records.filter((record) => record.id !== documentId)
    const fallbackRecord = remainingRecords[0] ?? createLibraryDocumentRecord(createSheetDocument())
    const nextActiveId = documentId === currentSnapshot.activeDocumentId ? fallbackRecord.id : currentSnapshot.activeDocumentId
    const snapshot = createDocumentLibrarySnapshot(remainingRecords.length > 0 ? remainingRecords : [fallbackRecord], nextActiveId)
    const activeRecord = readActiveRecord(snapshot.records, snapshot.activeDocumentId)

    set({
      documents: snapshot.summaries,
      activeDocumentId: activeRecord.id,
      libraryRecords: snapshot.records,
      ...createEditorContext(activeRecord.document),
      status: 'idle',
      message: 'Sheet deleted',
    })
    persistLibrarySnapshot(snapshot, set)
  },
  setError(message) {
    set({ status: 'error', message })
  },
  setTitle(title) {
    set((state) => {
      const document = { ...state.document, title }
      const snapshot = createCurrentSnapshot({ ...state, document })

      return { document, documents: snapshot.summaries, libraryRecords: snapshot.records, status: 'idle', message: 'Title changed' }
    })
  },
  addColumn(type = 'text') {
    const column = createColumn('新列', type)
    set((state) => ({
      document: addColumn(state.document, column),
      selectedColumnId: column.id,
      rightPanelMode: { kind: 'column', columnId: column.id },
      status: 'idle',
      message: 'Column added',
    }))
  },
  updateColumn(columnId, patch) {
    set((state) => ({
      document: updateColumn(state.document, columnId, patch),
      selectedColumnId: columnId,
      status: 'idle',
      message: 'Column updated',
    }))
  },
  moveColumn(columnId, direction) {
    set((state) => ({
      document: moveColumn(state.document, columnId, direction),
      selectedColumnId: columnId,
      activeRowId: undefined,
      activeCell: undefined,
      rightPanelMode: { kind: 'column', columnId },
      status: 'idle',
      message: 'Column moved',
    }))
  },
  moveColumnToIndex(columnId, targetIndex) {
    set((state) => ({
      document: moveColumnToIndex(state.document, columnId, targetIndex),
      selectedColumnId: columnId,
      activeRowId: undefined,
      activeCell: undefined,
      rightPanelMode: { kind: 'column', columnId },
      status: 'idle',
      message: 'Column moved',
    }))
  },
  removeColumn(columnId) {
    set((state) => {
      const document = removeColumn(state.document, columnId)
      const selectedColumnId = state.selectedColumnId === columnId ? document.columns[0]?.id : state.selectedColumnId
      const activeCell = state.activeCell?.columnId === columnId ? undefined : state.activeCell
      const rightPanelMode: RightPanelMode = state.rightPanelMode.kind !== 'empty' && state.rightPanelMode.columnId === columnId ? { kind: 'empty' } : state.rightPanelMode
      return {
        document,
        selectedColumnId,
        activeCell,
        rightPanelMode,
        status: 'idle',
        message: 'Column removed',
      }
    })
  },
  addRow() {
    set((state) => {
      const document = addRow(state.document)
      const rowId = document.rows.at(-1)?.id
      return { document, activeRowId: rowId, activeCell: undefined, rightPanelMode: { kind: 'empty' }, status: 'idle', message: 'Row added' }
    })
  },
  moveRow(rowId, direction) {
    set((state) => ({
      document: moveRow(state.document, rowId, direction),
      activeRowId: rowId,
      activeCell: undefined,
      rightPanelMode: { kind: 'empty' },
      status: 'idle',
      message: 'Row moved',
    }))
  },
  moveRowToIndex(rowId, targetIndex) {
    set((state) => ({
      document: moveRowToIndex(state.document, rowId, targetIndex),
      activeRowId: rowId,
      activeCell: undefined,
      rightPanelMode: { kind: 'empty' },
      status: 'idle',
      message: 'Row moved',
    }))
  },
  removeRow(rowId) {
    set((state) => {
      const document = removeRow(state.document, rowId)
      const activeRowId = state.activeRowId === rowId ? document.rows[0]?.id : state.activeRowId
      const activeCell = state.activeCell?.rowId === rowId ? undefined : state.activeCell
      const rightPanelMode: RightPanelMode = state.rightPanelMode.kind === 'cell' && state.rightPanelMode.rowId === rowId ? { kind: 'empty' } : state.rightPanelMode

      return { document, activeRowId, activeCell, rightPanelMode, status: 'idle', message: 'Row removed' }
    })
  },
  updateCell(rowId, columnId, value) {
    set((state) => ({ document: updateCell(state.document, rowId, columnId, value), status: 'idle', message: 'Cell updated' }))
  },
  selectRow(rowId) {
    set({ activeRowId: rowId, activeCell: undefined, rightPanelMode: { kind: 'empty' } })
  },
  selectCell(rowId, columnId) {
    set({ activeRowId: rowId, activeCell: { rowId, columnId }, selectedColumnId: columnId, rightPanelMode: { kind: 'cell', rowId, columnId } })
  },
  selectColumn(columnId) {
    set({ selectedColumnId: columnId, activeRowId: undefined, activeCell: undefined, rightPanelMode: { kind: 'column', columnId }, sidePanelCollapsed: false })
  },
  clearActivePanel() {
    set({ rightPanelMode: { kind: 'empty' }, activeCell: undefined })
  },
  toggleSidePanel() {
    set((state) => ({ sidePanelCollapsed: !state.sidePanelCollapsed }))
  },
}))

function createCurrentSnapshot(state: Pick<SheetStore, 'activeDocumentId' | 'document' | 'libraryRecords'>) {
  return createDocumentLibrarySnapshot(
    state.libraryRecords.map((record) => (record.id === state.activeDocumentId ? updateLibraryDocumentRecord(record, state.document) : record)),
    state.activeDocumentId,
  )
}

function readActiveRecord(records: LibraryDocumentRecord[], activeDocumentId: string): LibraryDocumentRecord {
  return records.find((record) => record.id === activeDocumentId) ?? records[0]
}

function createEditorContext(document: SheetDocument) {
  return {
    document,
    selectedColumnId: document.columns[0]?.id,
    activeRowId: document.rows[0]?.id,
    activeCell: undefined,
    rightPanelMode: { kind: 'empty' } as RightPanelMode,
  }
}

function persistLibrarySnapshot(snapshot: ReturnType<typeof createDocumentLibrarySnapshot>, set: (partial: Partial<SheetStore>) => void) {
  void saveDocumentLibrary(snapshot).catch((error: unknown) => {
    set({ status: 'error', message: error instanceof Error ? error.message : 'Failed to save sheet library' })
  })
}
