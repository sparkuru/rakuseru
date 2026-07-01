import { createId } from '../utils/ids'
import { createColumn } from './column'
import { createEmptyCellValue } from './cell'

export type ColumnType = 'text' | 'number' | 'money' | 'singleSelect' | 'multiSelect' | 'image' | 'link'

export type SheetDocument = {
  version: 1
  title: string
  columns: ColumnDef[]
  rows: RowData[]
}

export type ColumnDef = {
  id: string
  title: string
  type: ColumnType
  width?: number
  lockedWidth?: boolean
  wrap?: boolean
  options?: string[]
  required?: boolean
}

export type RowData = {
  id: string
  height?: number
  lockedHeight?: boolean
  cells: Record<string, CellValue>
}

export type ImageCellValue = {
  kind: 'image'
  name: string
  mime: string
  dataUrl: string
}

export type CellValue = string | number | string[] | ImageCellValue

export function createSheetDocument(title = 'Rakuseru 采购清单'): SheetDocument {
  const columns = [
    createColumn('物品', 'text'),
    createColumn('状态', 'singleSelect'),
    createColumn('数量', 'number'),
    createColumn('预算', 'money'),
    createColumn('标签', 'multiSelect'),
    createColumn('图片', 'image'),
    createColumn('链接', 'link'),
  ]

  return {
    version: 1,
    title,
    columns,
    rows: [createRow(columns), createRow(columns)],
  }
}

export function createRow(columns: ColumnDef[]): RowData {
  return {
    id: createId('row'),
    cells: Object.fromEntries(columns.map((column) => [column.id, createEmptyCellValue(column)])),
  }
}
