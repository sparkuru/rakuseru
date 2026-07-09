import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef as TableColumnDef,
} from '@tanstack/react-table'
import { GripHorizontal, GripVertical, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react'

import { COLUMN_TYPE_LABELS } from '../model/column'
import type { RowData } from '../model/document'
import { useSheetStore } from '../state/sheetStore'
import { CellEditor } from './CellEditor'

function joinClassNames(...classNames: Array<string | false | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

const COLUMN_DRAG_TYPE = 'application/x-rakuseru-column-id'
const ROW_DRAG_TYPE = 'application/x-rakuseru-row-id'

export function SheetView() {
  const document = useSheetStore((state) => state.document)
  const removeRow = useSheetStore((state) => state.removeRow)
  const moveRowToIndex = useSheetStore((state) => state.moveRowToIndex)
  const updateColumn = useSheetStore((state) => state.updateColumn)
  const moveColumnToIndex = useSheetStore((state) => state.moveColumnToIndex)
  const selectRow = useSheetStore((state) => state.selectRow)
  const selectCell = useSheetStore((state) => state.selectCell)
  const selectColumn = useSheetStore((state) => state.selectColumn)
  const selectedColumnId = useSheetStore((state) => state.selectedColumnId)
  const activeRowId = useSheetStore((state) => state.activeRowId)
  const activeCell = useSheetStore((state) => state.activeCell)
  const [draggingColumnId, setDraggingColumnId] = useState<string>()
  const [draggingRowId, setDraggingRowId] = useState<string>()
  const [columnDropId, setColumnDropId] = useState<string>()
  const [rowDropId, setRowDropId] = useState<string>()

  const startColumnResize = useCallback((columnId: string, width: number, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = width

    function handlePointerMove(moveEvent: PointerEvent) {
      updateColumn(columnId, { width: Math.max(80, startWidth + moveEvent.clientX - startX) })
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }, [updateColumn])

  const startColumnDrag = useCallback((columnId: string, event: ReactDragEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(COLUMN_DRAG_TYPE, columnId)
    event.dataTransfer.setData('text/plain', columnId)
    setDraggingColumnId(columnId)
  }, [])

  const startRowDrag = useCallback((rowId: string, event: ReactDragEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(ROW_DRAG_TYPE, rowId)
    event.dataTransfer.setData('text/plain', rowId)
    setDraggingRowId(rowId)
  }, [])

  const endDrag = useCallback(() => {
    setDraggingColumnId(undefined)
    setDraggingRowId(undefined)
    setColumnDropId(undefined)
    setRowDropId(undefined)
  }, [])

  const handleColumnDrop = useCallback((targetColumnId: string, targetIndex: number, event: ReactDragEvent<HTMLTableCellElement>) => {
    const columnId = event.dataTransfer.getData(COLUMN_DRAG_TYPE)
    if (!columnId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setColumnDropId(undefined)
    if (columnId !== targetColumnId) {
      moveColumnToIndex(columnId, targetIndex)
    }
  }, [moveColumnToIndex])

  const handleRowDrop = useCallback((targetRowId: string, targetIndex: number, event: ReactDragEvent<HTMLTableRowElement>) => {
    const rowId = event.dataTransfer.getData(ROW_DRAG_TYPE)
    if (!rowId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setRowDropId(undefined)
    if (rowId !== targetRowId) {
      moveRowToIndex(rowId, targetIndex)
    }
  }, [moveRowToIndex])

  const tableColumns = useMemo<TableColumnDef<RowData>[]>(() => {
    return [
      {
        id: '_rowActions',
        header: '序号',
        size: 84,
        cell: ({ row }) => (
          <div className="row-number-cell">
            <button
              type="button"
              className="row-drag-handle"
              draggable
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => startRowDrag(row.original.id, event)}
              onDragEnd={endDrag}
              title="拖动移动行"
              aria-label="拖动移动行"
            >
              <GripVertical size={16} strokeWidth={2} />
            </button>
            <span className="row-number-label">{row.index + 1}</span>
            <div className="row-action-buttons" aria-label="行操作">
              <button
                type="button"
                className="icon-button ghost row-delete-button"
                onClick={(event) => {
                  event.stopPropagation()
                  removeRow(row.original.id)
                }}
                title="删除行"
                aria-label="删除行"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ),
      },
      ...document.columns.map<TableColumnDef<RowData>>((column) => ({
        id: column.id,
        header: () => (
          <div className="header-cell">
            <button
              type="button"
              className={column.id === selectedColumnId ? 'header-button selected' : 'header-button'}
              onClick={() => selectColumn(column.id)}
            >
              <span>{column.title}</span>
              <small>{COLUMN_TYPE_LABELS[column.type]}</small>
            </button>
            <button
              type="button"
              className="column-drag-handle"
              draggable
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => startColumnDrag(column.id, event)}
              onDragEnd={endDrag}
              title="拖动移动列"
              aria-label="拖动移动列"
            >
              <GripHorizontal size={13} />
            </button>
            <span
              className={column.lockedWidth ? 'column-resize-handle locked' : 'column-resize-handle'}
              title={column.lockedWidth ? '列宽已锁定' : '拖动调整列宽'}
              aria-label={column.lockedWidth ? '列宽已锁定' : '拖动调整列宽'}
              role="separator"
              onPointerDown={(event) => {
                if (column.lockedWidth) {
                  event.preventDefault()
                  event.stopPropagation()
                  return
                }

                startColumnResize(column.id, column.width ?? 160, event)
              }}
            />
          </div>
        ),
        size: column.width ?? 160,
        cell: ({ row }) => <CellEditor row={row.original} column={column} />,
      })),
    ]
  }, [document.columns, endDrag, removeRow, selectColumn, selectedColumnId, startColumnDrag, startColumnResize, startRowDrag])

  const table = useReactTable({
    data: document.rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="sheet-surface" aria-label="Sheet editor">
      <div className="table-scroll">
        <table className="sheet-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={joinClassNames(
                      header.id === selectedColumnId && 'selected-column',
                      header.id === draggingColumnId && 'dragging-column',
                      header.id === columnDropId && 'drag-over-column',
                    )}
                    style={{ width: header.getSize() }}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes(COLUMN_DRAG_TYPE) || header.id === '_rowActions') {
                        return
                      }

                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setColumnDropId(header.id)
                    }}
                    onDragLeave={() => {
                      if (columnDropId === header.id) {
                        setColumnDropId(undefined)
                      }
                    }}
                    onDrop={(event) => {
                      const targetIndex = document.columns.findIndex((column) => column.id === header.id)
                      if (targetIndex >= 0) {
                        handleColumnDrop(header.id, targetIndex, event)
                      }
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={joinClassNames(
                  row.original.id === activeRowId && 'active-row',
                  row.original.id === draggingRowId && 'dragging-row',
                  row.original.id === rowDropId && 'drag-over-row',
                )}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(ROW_DRAG_TYPE)) {
                    return
                  }

                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setRowDropId(row.original.id)
                }}
                onDragLeave={() => {
                  if (rowDropId === row.original.id) {
                    setRowDropId(undefined)
                  }
                }}
                onDrop={(event) => handleRowDrop(row.original.id, row.index, event)}
              >
                {row.getVisibleCells().map((cell) => {
                  const isDataCell = cell.column.id !== '_rowActions'
                  const isActiveCell = activeCell?.rowId === row.original.id && activeCell.columnId === cell.column.id
                  const xCoordinate = document.columns.findIndex((column) => column.id === cell.column.id) + 1
                  const yCoordinate = document.rows.findIndex((documentRow) => documentRow.id === row.original.id) + 1

                  return (
                    <td
                      key={cell.id}
                      className={joinClassNames(
                        cell.column.id === '_rowActions' && 'row-actions-cell',
                        cell.column.id === selectedColumnId && 'selected-column',
                        isActiveCell && 'active-cell',
                      )}
                      onClick={() => {
                        if (!isDataCell) {
                          selectRow(row.original.id)
                          return
                        }

                        selectCell(row.original.id, cell.column.id)
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      {isDataCell && isActiveCell && <span className="cell-coordinate">{`(x${xCoordinate},y${yCoordinate})`}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
