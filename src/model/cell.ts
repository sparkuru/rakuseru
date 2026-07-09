import type { CellValue, ColumnDef } from './document'

export function createEmptyCellValue(column: ColumnDef): CellValue {
  switch (column.type) {
    case 'number':
    case 'money':
      return 0
    case 'multiSelect':
      return []
    case 'image':
      return ''
    case 'link':
    case 'singleSelect':
    case 'text':
      return ''
  }
}

export function coerceCellValue(column: ColumnDef, value: CellValue): CellValue {
  switch (column.type) {
    case 'number':
    case 'money': {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }

      const numeric = typeof value === 'string' ? Number(value.replace(/[$,]/g, '')) : Number.NaN
      return Number.isFinite(numeric) ? numeric : 0
    }
    case 'singleSelect': {
      if (typeof value !== 'string') {
        return ''
      }

      if (!column.options?.length) {
        return value
      }

      return column.options.includes(value) ? value : ''
    }
    case 'multiSelect': {
      const values = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
      if (!column.options?.length) {
        return values.filter((item): item is string => typeof item === 'string')
      }

      return values.filter((item): item is string => typeof item === 'string' && column.options!.includes(item))
    }
    case 'image':
      return isImageValue(value) ? value : ''
    case 'link':
    case 'text':
      return stringifyCellValue(value)
  }
}

export function stringifyCellValue(value: CellValue): string {
  if (typeof value === 'number') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  if (isImageValue(value)) {
    return value.name
  }

  return value
}

export function isImageValue(value: unknown): value is Extract<CellValue, { kind: 'image' }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    candidate.kind === 'image' &&
    typeof candidate.name === 'string' &&
    typeof candidate.mime === 'string' &&
    typeof candidate.dataUrl === 'string' &&
    (candidate.fit === undefined || candidate.fit === 'contain' || candidate.fit === 'cover' || candidate.fit === 'fill' || candidate.fit === 'center')
  )
}
