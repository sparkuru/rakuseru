import { createColumn, COLUMN_TYPES } from '../model/column'
import type { CellValue, ColumnType, SheetDocument } from '../model/document'
import { createId } from '../utils/ids'
import { isHttpUrl } from '../model/url'

export type XlsxImportSeverity = 'warning' | 'error'

export type XlsxImportIssue = {
  id: string
  severity: XlsxImportSeverity
  message: string
  locationLabel?: string
}

export type XlsxImportCell = {
  sourceRow: number
  text: string
  isDate: boolean
}

export type XlsxImportColumn = {
  sourceColumn: number
  sourceTitle: string
  cells: XlsxImportCell[]
}

export type XlsxImportSheet = {
  name: string
  columns: XlsxImportColumn[]
  rowCount: number
  warnings: XlsxImportIssue[]
}

export type XlsxImportWorkbook = {
  sheets: XlsxImportSheet[]
  defaultSheetName: string
}

export type XlsxColumnMapping = {
  sourceColumn: number
  title: string
  type: XlsxMappableColumnType
}

export type XlsxImportBuildResult = {
  document?: SheetDocument
  issues: XlsxImportIssue[]
}

export type XlsxMappableColumnType = Exclude<ColumnType, 'image'>

export const XLSX_MAPPABLE_COLUMN_TYPES = COLUMN_TYPES.filter((type): type is XlsxMappableColumnType => type !== 'image')

export async function parseXlsxWorkbook(content: ArrayBuffer): Promise<XlsxImportWorkbook> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()

  try {
    await workbook.xlsx.load(content)
  } catch (error) {
    throw new Error(error instanceof Error ? `无法读取 XLSX 文件：${error.message}` : '无法读取 XLSX 文件。', { cause: error })
  }

  const sheets = workbook.worksheets.map((worksheet) => createSheetPreview(worksheet))
  const firstNonEmpty = sheets.find((sheet) => sheet.columns.length > 0)

  if (!firstNonEmpty) {
    throw new Error('此 XLSX 文件没有可导入的非空工作表。')
  }

  return { sheets, defaultSheetName: firstNonEmpty.name }
}

export function createXlsxColumnMappings(sheet: XlsxImportSheet): XlsxColumnMapping[] {
  return sheet.columns.map((column) => ({
    sourceColumn: column.sourceColumn,
    title: column.sourceTitle,
    type: 'text',
  }))
}

export function buildXlsxDocument(sheet: XlsxImportSheet, mappings: XlsxColumnMapping[], title = sheet.name): XlsxImportBuildResult {
  const issues = validateMappings(sheet, mappings, title)

  if (issues.some((issue) => issue.severity === 'error')) {
    return { issues }
  }

  const mappingsBySourceColumn = new Map(mappings.map((mapping) => [mapping.sourceColumn, mapping]))
  const columns = sheet.columns.map((sourceColumn) => {
    const mapping = mappingsBySourceColumn.get(sourceColumn.sourceColumn)!
    const column = createColumn(mapping.title.trim(), mapping.type)

    if (mapping.type === 'singleSelect') {
      return { ...column, options: uniqueNonEmpty(sourceColumn.cells.map((cell) => cell.text)) }
    }

    if (mapping.type === 'multiSelect') {
      return { ...column, options: uniqueNonEmpty(sourceColumn.cells.flatMap((cell) => splitMultiSelect(cell.text))) }
    }

    return column
  })

  const rows = Array.from({ length: sheet.rowCount }, (_, rowIndex) => ({
    id: createId('row'),
    cells: Object.fromEntries(sheet.columns.map((sourceColumn, columnIndex) => {
      const mapping = mappingsBySourceColumn.get(sourceColumn.sourceColumn)!
      const cell = sourceColumn.cells[rowIndex]
      return [columns[columnIndex].id, convertCell(cell?.text ?? '', mapping.type)]
    })),
  }))

  return {
    document: {
      version: 1,
      title: title.trim(),
      columns,
      rows,
    },
    issues,
  }
}

function createSheetPreview(worksheet: import('exceljs').Worksheet): XlsxImportSheet {
  const matrix = Array.from({ length: worksheet.rowCount }, (_, rowIndex) => (
    Array.from({ length: worksheet.columnCount }, (_, columnIndex) => readCell(worksheet.getCell(rowIndex + 1, columnIndex + 1)))
  ))
  const headerIndex = matrix.findIndex((row) => row.some((cell) => hasText(cell.text)))
  const warnings: XlsxImportIssue[] = []

  if (worksheet.getImages().length > 0) {
    warnings.push(createIssue('images', 'warning', '工作表中的嵌入图片不会导入。'))
  }
  if (worksheet.hasMerges) {
    warnings.push(createIssue('merges', 'warning', '合并单元格只会保留左上角的值，布局不会导入。'))
  }

  if (headerIndex < 0) {
    return { name: worksheet.name, columns: [], rowCount: 0, warnings }
  }

  const retainedColumnIndexes = matrix[headerIndex]
    .map((_, columnIndex) => columnIndex)
    .filter((columnIndex) => matrix.some((row) => hasText(row[columnIndex]?.text ?? '')))
  const sourceRows = matrix.slice(headerIndex + 1).filter((row) => retainedColumnIndexes.some((columnIndex) => hasText(row[columnIndex]?.text ?? '')))

  return {
    name: worksheet.name,
    columns: retainedColumnIndexes.map((columnIndex) => ({
      sourceColumn: columnIndex + 1,
      sourceTitle: matrix[headerIndex][columnIndex].text,
      cells: sourceRows.map((row) => row[columnIndex]),
    })),
    rowCount: sourceRows.length,
    warnings,
  }
}

function readCell(cell: import('exceljs').Cell): XlsxImportCell {
  if (cell.isMerged && cell.master.address !== cell.address) {
    return { sourceRow: Number(cell.row), text: '', isDate: false }
  }

  if (cell.formula) {
    return { sourceRow: Number(cell.row), text: `=${cell.formula}`, isDate: false }
  }

  return {
    sourceRow: Number(cell.row),
    text: cell.value instanceof Date ? formatDateText(cell.value, cell.numFmt) : cell.text,
    isDate: cell.value instanceof Date,
  }
}

function validateMappings(sheet: XlsxImportSheet, mappings: XlsxColumnMapping[], title: string): XlsxImportIssue[] {
  const issues: XlsxImportIssue[] = []
  const mappingsBySourceColumn = new Map(mappings.map((mapping) => [mapping.sourceColumn, mapping]))

  if (sheet.columns.length === 0) {
    issues.push(createIssue('empty-sheet', 'error', '此工作表没有可导入的数据。'))
  }

  if (title.trim() === '') {
    issues.push(createIssue('document-title', 'error', '清单标题不能为空。'))
  }

  const titles = new Map<string, number>()
  for (const sourceColumn of sheet.columns) {
    const mapping = mappingsBySourceColumn.get(sourceColumn.sourceColumn)
    if (!mapping) {
      issues.push(createIssue(`mapping-${sourceColumn.sourceColumn}`, 'error', '缺少列映射。', sourceColumn.sourceTitle))
      continue
    }

    const normalizedTitle = mapping.title.trim()
    if (!normalizedTitle) {
      issues.push(createIssue(`header-${sourceColumn.sourceColumn}`, 'error', '列标题不能为空。', columnLocation(sourceColumn)))
    } else if (titles.has(normalizedTitle)) {
      issues.push(createIssue(`header-duplicate-${sourceColumn.sourceColumn}`, 'error', '列标题不能重复。', columnLocation(sourceColumn)))
    } else {
      titles.set(normalizedTitle, sourceColumn.sourceColumn)
    }

    for (const cell of sourceColumn.cells) {
      if (!hasText(cell.text)) {
        continue
      }

      if ((mapping.type === 'number' || mapping.type === 'money') && (cell.isDate || !isNumericText(cell.text))) {
        issues.push(createIssue(`numeric-${sourceColumn.sourceColumn}-${cell.sourceRow}`, 'error', `${mapping.type === 'money' ? '金额' : '数字'}列包含无法转换的值。`, cellLocation(sourceColumn, cell)))
      }
      if (mapping.type === 'link' && !isHttpUrl(cell.text.trim())) {
        issues.push(createIssue(`link-${sourceColumn.sourceColumn}-${cell.sourceRow}`, 'error', '链接列只接受 http 或 https 地址。', cellLocation(sourceColumn, cell)))
      }
    }
  }

  return issues
}

function convertCell(value: string, type: XlsxMappableColumnType): CellValue {
  switch (type) {
    case 'number':
    case 'money':
      return Number(value.replace(/[$,]/g, ''))
    case 'multiSelect':
      return splitMultiSelect(value)
    case 'link':
    case 'singleSelect':
    case 'text':
      return value
  }
}

function isNumericText(value: string): boolean {
  return Number.isFinite(Number(value.replace(/[$,]/g, '')))
}

function splitMultiSelect(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function hasText(value: string): boolean {
  return value.trim() !== ''
}

function formatDateText(date: Date, numberFormat?: string): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1)
  const day = String(date.getDate())
  const paddedMonth = month.padStart(2, '0')
  const paddedDay = day.padStart(2, '0')

  if (numberFormat && /^[ymd./\-\s]+$/i.test(numberFormat)) {
    return numberFormat.replace(/yyyy|yy|mm|m|dd|d/gi, (token) => {
      switch (token.toLowerCase()) {
        case 'yyyy':
          return year
        case 'yy':
          return year.slice(-2)
        case 'mm':
          return paddedMonth
        case 'm':
          return month
        case 'dd':
          return paddedDay
        case 'd':
          return day
        default:
          return token
      }
    })
  }

  return `${year}-${paddedMonth}-${paddedDay}`
}

function createIssue(id: string, severity: XlsxImportSeverity, message: string, locationLabel?: string): XlsxImportIssue {
  return { id, severity, message, locationLabel }
}

function columnLocation(column: XlsxImportColumn): string {
  return `第 ${column.sourceColumn} 列`
}

function cellLocation(column: XlsxImportColumn, cell: XlsxImportCell): string {
  return `第 ${cell.sourceRow} 行，第 ${column.sourceColumn} 列`
}
