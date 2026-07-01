import { create } from 'zustand'

import { addColumn, createColumn, removeColumn, updateColumn } from '../model/column'
import { createSheetDocument } from '../model/document'
import type { CellValue, ColumnDef, ColumnType, SheetDocument } from '../model/document'
import { addRow, removeRow, updateCell } from '../model/row'
import { loadActiveDocument, saveActiveDocument } from '../storage/indexedDb'

type SheetStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type SheetStore = {
  document: SheetDocument
  selectedColumnId?: string
  status: SheetStatus
  message: string
  load: () => Promise<void>
  save: () => Promise<void>
  setDocument: (document: SheetDocument, message?: string) => void
  setError: (message: string) => void
  setTitle: (title: string) => void
  addColumn: (type?: ColumnType) => void
  updateColumn: (columnId: string, patch: Partial<ColumnDef>) => void
  removeColumn: (columnId: string) => void
  addRow: () => void
  removeRow: (rowId: string) => void
  updateCell: (rowId: string, columnId: string, value: CellValue) => void
  selectColumn: (columnId: string) => void
}

export const useSheetStore = create<SheetStore>((set, get) => ({
  document: createSheetDocument(),
  selectedColumnId: undefined,
  status: 'idle',
  message: '',
  async load() {
    set({ status: 'loading', message: 'Loading saved sheet' })
    try {
      const loaded = await loadActiveDocument()
      set({
        document: loaded ?? createSheetDocument(),
        selectedColumnId: (loaded ?? get().document).columns[0]?.id,
        status: 'saved',
        message: loaded ? 'Loaded from this browser' : 'Started sample sheet',
      })
    } catch (error) {
      set({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load sheet' })
    }
  },
  async save() {
    set({ status: 'saving', message: 'Saving' })
    try {
      await saveActiveDocument(get().document)
      set({ status: 'saved', message: 'Saved locally' })
    } catch (error) {
      set({ status: 'error', message: error instanceof Error ? error.message : 'Failed to save sheet' })
    }
  },
  setDocument(document, message = 'Document replaced') {
    set({ document, selectedColumnId: document.columns[0]?.id, status: 'idle', message })
  },
  setError(message) {
    set({ status: 'error', message })
  },
  setTitle(title) {
    set((state) => ({ document: { ...state.document, title }, status: 'idle', message: 'Title changed' }))
  },
  addColumn(type = 'text') {
    const column = createColumn('新列', type)
    set((state) => ({
      document: addColumn(state.document, column),
      selectedColumnId: column.id,
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
  removeColumn(columnId) {
    set((state) => {
      const document = removeColumn(state.document, columnId)
      return {
        document,
        selectedColumnId: document.columns[0]?.id,
        status: 'idle',
        message: 'Column removed',
      }
    })
  },
  addRow() {
    set((state) => ({ document: addRow(state.document), status: 'idle', message: 'Row added' }))
  },
  removeRow(rowId) {
    set((state) => ({ document: removeRow(state.document, rowId), status: 'idle', message: 'Row removed' }))
  },
  updateCell(rowId, columnId, value) {
    set((state) => ({ document: updateCell(state.document, rowId, columnId, value), status: 'idle', message: 'Cell updated' }))
  },
  selectColumn(columnId) {
    set({ selectedColumnId: columnId })
  },
}))
