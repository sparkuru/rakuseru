import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef as TableColumnDef,
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import type { RowData } from '../model/document'
import { useSheetStore } from '../state/sheetStore'
import { CellEditor } from './CellEditor'

function joinClassNames(...classNames: Array<string | false | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

export function SheetView() {
  const document = useSheetStore((state) => state.document)
  const removeRow = useSheetStore((state) => state.removeRow)
  const selectRow = useSheetStore((state) => state.selectRow)
  const selectCell = useSheetStore((state) => state.selectCell)
  const selectColumn = useSheetStore((state) => state.selectColumn)
  const selectedColumnId = useSheetStore((state) => state.selectedColumnId)
  const activeRowId = useSheetStore((state) => state.activeRowId)
  const activeCell = useSheetStore((state) => state.activeCell)

  const tableColumns = useMemo<TableColumnDef<RowData>[]>(() => {
    return [
      {
        id: '_rowActions',
        header: '',
        size: 48,
        cell: ({ row }) => (
          <button
            type="button"
            className="icon-button ghost row-delete-button"
            onClick={(event) => {
              event.stopPropagation()
              removeRow(row.original.id)
            }}
            title="Delete row"
            aria-label="Delete row"
          >
            <Trash2 size={16} />
          </button>
        ),
      },
      ...document.columns.map<TableColumnDef<RowData>>((column) => ({
        id: column.id,
        header: () => (
          <button
            type="button"
            className={column.id === selectedColumnId ? 'header-button selected' : 'header-button'}
            onClick={() => selectColumn(column.id)}
          >
            <span>{column.title}</span>
            <small>{column.type}</small>
          </button>
        ),
        size: column.width ?? 160,
        cell: ({ row }) => <CellEditor row={row.original} column={column} />,
      })),
    ]
  }, [document.columns, removeRow, selectColumn, selectedColumnId])

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
                    className={header.id === selectedColumnId ? 'selected-column' : undefined}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={row.original.id === activeRowId ? 'active-row' : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={joinClassNames(
                      cell.column.id === '_rowActions' && 'row-actions-cell',
                      cell.column.id === selectedColumnId && 'selected-column',
                      activeCell?.rowId === row.original.id && activeCell.columnId === cell.column.id && 'active-cell',
                    )}
                    onClick={() => {
                      if (cell.column.id === '_rowActions') {
                        selectRow(row.original.id)
                        return
                      }

                      selectCell(row.original.id, cell.column.id)
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
