export const SHEET_DOCUMENT_VERSION = 1 as const

export type ColumnType = 'text' | 'number' | 'money' | 'singleSelect' | 'multiSelect' | 'image' | 'link'
export type ColumnAlign = 'left' | 'center' | 'right'

export const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'money', 'singleSelect', 'multiSelect', 'image', 'link']
export const COLUMN_ALIGNMENTS: ColumnAlign[] = ['left', 'center', 'right']

export type SheetDocument = {
  version: typeof SHEET_DOCUMENT_VERSION
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
  align?: ColumnAlign
  options?: string[]
  required?: boolean
  backgroundColor?: string
}

export type RowData = {
  id: string
  height?: number
  lockedHeight?: boolean
  backgroundColor?: string
  cellBackgroundColors?: Record<string, string>
  cells: Record<string, CellValue>
}

export type ImageFit = 'contain' | 'cover' | 'fill' | 'center'

export type ImageCellValue = {
  kind: 'image'
  name: string
  mime: string
  dataUrl: string
  fit?: ImageFit
}

export type CellValue = string | number | string[] | ImageCellValue
