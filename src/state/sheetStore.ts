import { create } from 'zustand'

import { addColumn, createColumn, moveColumn, moveColumnToIndex, removeColumn, updateColumn } from '../model/column'
import { createSheetDocument } from '../model/document'
import type { CellValue, ColumnDef, ColumnType, SheetDocument } from '../model/document'
import { addRow, moveRow, moveRowToIndex, removeRow, updateCell } from '../model/row'
import { loadActiveDocument, saveActiveDocument } from '../storage/indexedDb'

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

export const useSheetStore = create<SheetStore>((set, get) => ({
  document: createSheetDocument(),
  selectedColumnId: undefined,
  activeRowId: undefined,
  activeCell: undefined,
  rightPanelMode: { kind: 'empty' },
  sidePanelCollapsed: false,
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
        rightPanelMode: { kind: 'empty' },
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
    set({ document, selectedColumnId: document.columns[0]?.id, activeRowId: document.rows[0]?.id, activeCell: undefined, rightPanelMode: { kind: 'empty' }, status: 'idle', message })
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
