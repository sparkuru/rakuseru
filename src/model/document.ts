import { createId } from '../utils/ids'
import { createColumn } from './column'
import { createEmptyCellValue } from './cell'

import type { ColumnDef, RowData, SheetDocument } from '../../packages/document-contract/src/index'

export type {
  CellValue,
  ColumnAlign,
  ColumnDef,
  ColumnType,
  ImageCellValue,
  ImageFit,
  RowData,
  SheetDocument,
} from '../../packages/document-contract/src/index'

export function createSheetDocument(title = '新的清单'): SheetDocument {
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
