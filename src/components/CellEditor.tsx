import { Image as ImageIcon, Link } from 'lucide-react'

import { isImageValue, stringifyCellValue } from '../model/cell'
import { getColumnAlign } from '../model/column'
import type { CellValue, ColumnDef, ImageFit, RowData } from '../model/document'
import { useSheetStore } from '../state/sheetStore'

type CellEditorProps = {
  row: RowData
  column: ColumnDef
}

const IMAGE_FIT_CLASS: Record<ImageFit, string> = {
  contain: 'fit-contain',
  cover: 'fit-cover',
  fill: 'fit-fill',
  center: 'fit-center',
}

export function CellEditor({ row, column }: CellEditorProps) {
  const updateCell = useSheetStore((state) => state.updateCell)
  const selectColumn = useSheetStore((state) => state.selectColumn)
  const value = row.cells[column.id] ?? ''
  const alignClassName = `align-${getColumnAlign(column)}`

  function commit(nextValue: CellValue) {
    updateCell(row.id, column.id, nextValue)
  }

  switch (column.type) {
    case 'number':
    case 'money':
      return <span className={`cell-display numeric-display ${alignClassName}`}>{typeof value === 'number' ? value : stringifyCellValue(value)}</span>
    case 'singleSelect':
      if (!(column.options ?? []).length) {
        return (
          <button
            type="button"
            className="cell-setup-button"
            onClick={(event) => {
              event.stopPropagation()
              selectColumn(column.id)
            }}
          >
            配置选项
          </button>
        )
      }

      return (
        <select className={`cell-input ${alignClassName}`} value={typeof value === 'string' ? value : ''} onChange={(event) => commit(event.target.value)}>
          <option value="">-</option>
          {(column.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    case 'multiSelect': {
      if (!(column.options ?? []).length) {
        return (
          <button
            type="button"
            className="cell-setup-button"
            onClick={(event) => {
              event.stopPropagation()
              selectColumn(column.id)
            }}
          >
            配置选项
          </button>
        )
      }

      const selected = Array.isArray(value) ? value : []
      return (
        <div className={`multi-select-cell ${alignClassName}`} role="group" aria-label={`${column.title} options`}>
          {(column.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              className={selected.includes(option) ? 'choice-chip selected' : 'choice-chip'}
              aria-pressed={selected.includes(option)}
              onClick={() => {
                commit(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )
    }
    case 'image':
      return (
        <div className={`image-cell ${alignClassName}`}>
          {isImageValue(value) ? (
            <figure className={`image-preview ${IMAGE_FIT_CLASS[value.fit ?? 'cover']}`}>
              <img src={value.dataUrl} alt={value.name} />
              <figcaption title={value.name}>{value.name}</figcaption>
            </figure>
          ) : (
            <div className="image-empty">
              <ImageIcon size={16} />
              <span>选择图片</span>
            </div>
          )}
        </div>
      )
    case 'link': {
      const link = typeof value === 'string' ? value : stringifyCellValue(value)
      return (
        <span className={link ? `cell-display link-display ${alignClassName}` : `cell-display muted ${alignClassName}`}>
          <Link size={14} aria-hidden="true" />
          <span>{link || '空链接'}</span>
        </span>
      )
    }
    case 'text': {
      const text = typeof value === 'string' ? value : stringifyCellValue(value)
      return <span className={text ? `cell-display text-display ${alignClassName}` : `cell-display muted ${alignClassName}`}>{text || '空白'}</span>
    }
  }
}
