import { isImageValue } from './cell'
import type { CellValue, ColumnDef, RowData, SheetDocument } from './document'
import { isHttpUrl } from './url'

export type ValidationSeverity = 'warning' | 'error'

export type ValidationIssue = {
  id: string
  severity: ValidationSeverity
  rowId?: string
  columnId?: string
  x?: number
  y?: number
  columnTitle?: string
  locationLabel: string
  message: string
}

export function validateDocumentContent(document: SheetDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  document.rows.forEach((row, rowIndex) => {
    document.columns.forEach((column, columnIndex) => {
      const value = row.cells[column.id]
      const x = columnIndex + 1
      const y = rowIndex + 1

      if (column.required && isMissingRequiredValue(column, value)) {
        issues.push(createCellIssue(row, column, x, y, 'required', 'error', `${column.title} 为必填。`))
      }

      if (column.type === 'link' && typeof value === 'string' && value.trim() && !isHttpUrl(value.trim())) {
        issues.push(createCellIssue(row, column, x, y, 'link', 'error', `${column.title} 需要填写 http 或 https 链接。`))
      }

      if (column.type === 'singleSelect' && typeof value === 'string' && value && !isConfiguredOption(column, value)) {
        issues.push(createCellIssue(row, column, x, y, 'single-select', column.options?.length ? 'error' : 'warning', `${column.title} 的选项不在当前列配置中。`))
      }

      if (column.type === 'multiSelect' && Array.isArray(value)) {
        const invalidValues = value.filter((item) => !isConfiguredOption(column, item))
        if (invalidValues.length > 0) {
          issues.push(createCellIssue(row, column, x, y, 'multi-select', column.options?.length ? 'error' : 'warning', `${column.title} 包含未配置的选项：${invalidValues.join(', ')}。`))
        }
      }

      if (column.type === 'image' && value && !isImageValue(value)) {
        issues.push(createCellIssue(row, column, x, y, 'image', 'error', `${column.title} 的图片数据无效。`))
      }
    })
  })

  return issues
}

function createCellIssue(row: RowData, column: ColumnDef, x: number, y: number, rule: string, severity: ValidationSeverity, message: string): ValidationIssue {
  return {
    id: `${row.id}:${column.id}:${rule}`,
    severity,
    rowId: row.id,
    columnId: column.id,
    x,
    y,
    columnTitle: column.title,
    locationLabel: `(x${x},y${y}) ${column.title}`,
    message,
  }
}

function isMissingRequiredValue(column: ColumnDef, value: CellValue | undefined): boolean {
  switch (column.type) {
    case 'number':
    case 'money':
      return typeof value !== 'number' || !Number.isFinite(value)
    case 'multiSelect':
      return !Array.isArray(value) || value.length === 0
    case 'image':
      return !isImageValue(value)
    case 'link':
    case 'singleSelect':
    case 'text':
      return typeof value !== 'string' || value.trim() === ''
  }
}

function isConfiguredOption(column: ColumnDef, value: string): boolean {
  return Boolean(column.options?.includes(value))
}
