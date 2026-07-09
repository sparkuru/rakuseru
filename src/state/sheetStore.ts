import { create } from 'zustand'

import { addColumn, createColumn, removeColumn, updateColumn } from '../model/column'
import { createSheetDocument } from '../model/document'
import type { CellValue, ColumnDef, ColumnType, SheetDocument } from '../model/document'
import { addRow, removeRow, updateCell } from '../model/row'
import { loadActiveDocument, saveActiveDocument } from '../storage/indexedDb'

type SheetStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type ActiveCell = {
  rowId: string
  columnId: string
}

type SheetStore = {
  document: SheetDocument
  selectedColumnId?: string
  activeRowId?: string
  activeCell?: ActiveCell
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
  selectRow: (rowId: string) => void
  selectCell: (rowId: string, columnId: string) => void
  selectColumn: (columnId: string) => void
}

export const useSheetStore = create<SheetStore>((set, get) => ({
  document: createSheetDocument(),
  selectedColumnId: undefined,
  activeRowId: undefined,
  activeCell: undefined,
  status: 'idle',
  message: '',
  async load() {
    set({ status: 'loading', message: 'Loading saved sheet' })
    try {
      const loaded = await loadActiveDocument()
      set({
        document: loaded ?? createSheetDocument(),
        selectedColumnId: (loaded ?? get().document).columns[0]?.id,
        activeRowId: (loaded ?? get().document).rows[0]?.id,
        activeCell: undefined,
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
    set({ document, selectedColumnId: document.columns[0]?.id, activeRowId: document.rows[0]?.id, activeCell: undefined, status: 'idle', message })
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
      const selectedColumnId = state.selectedColumnId === columnId ? document.columns[0]?.id : state.selectedColumnId
      const activeCell = state.activeCell?.columnId === columnId ? undefined : state.activeCell
      return {
        document,
        selectedColumnId,
        activeCell,
        status: 'idle',
        message: 'Column removed',
      }
    })
  },
  addRow() {
    set((state) => {
      const document = addRow(state.document)
      const rowId = document.rows.at(-1)?.id
      return { document, activeRowId: rowId, activeCell: undefined, status: 'idle', message: 'Row added' }
    })
  },
  removeRow(rowId) {
    set((state) => {
      const document = removeRow(state.document, rowId)
      const activeRowId = state.activeRowId === rowId ? document.rows[0]?.id : state.activeRowId
      const activeCell = state.activeCell?.rowId === rowId ? undefined : state.activeCell

      return { document, activeRowId, activeCell, status: 'idle', message: 'Row removed' }
    })
  },
  updateCell(rowId, columnId, value) {
    set((state) => ({ document: updateCell(state.document, rowId, columnId, value), status: 'idle', message: 'Cell updated' }))
  },
  selectRow(rowId) {
    set({ activeRowId: rowId })
  },
  selectCell(rowId, columnId) {
    set({ activeRowId: rowId, activeCell: { rowId, columnId }, selectedColumnId: columnId })
  },
  selectColumn(columnId) {
    set({ selectedColumnId: columnId })
  },
}))
