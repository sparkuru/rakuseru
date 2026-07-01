import { Link, Image as ImageIcon, X } from 'lucide-react'
import type { ChangeEvent, ClipboardEvent } from 'react'

import { isImageValue } from '../model/cell'
import type { CellValue, ColumnDef, RowData } from '../model/document'
import { useSheetStore } from '../state/sheetStore'
import { readImageFile } from '../utils/image'

type CellEditorProps = {
  row: RowData
  column: ColumnDef
}

export function CellEditor({ row, column }: CellEditorProps) {
  const updateCell = useSheetStore((state) => state.updateCell)
  const value = row.cells[column.id] ?? ''

  function commit(nextValue: CellValue) {
    updateCell(row.id, column.id, nextValue)
  }

  async function commitImage(file: File | undefined) {
    if (!file) {
      return
    }

    commit(await readImageFile(file))
  }

  async function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'))
    if (imageItem) {
      event.preventDefault()
      await commitImage(imageItem)
    }
  }

  switch (column.type) {
    case 'number':
    case 'money':
      return (
        <input
          className="cell-input numeric"
          type="number"
          value={typeof value === 'number' ? value : 0}
          onChange={(event) => commit(Number(event.target.value))}
        />
      )
    case 'singleSelect':
      return (
        <select className="cell-input" value={typeof value === 'string' ? value : ''} onChange={(event) => commit(event.target.value)}>
          <option value="">-</option>
          {(column.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    case 'multiSelect': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="multi-select-cell">
          {(column.options ?? []).map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => {
                  commit(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )
    }
    case 'image':
      return (
        <div className="image-cell" onPaste={(event) => void handlePaste(event)}>
          {isImageValue(value) ? (
            <figure>
              <img src={value.dataUrl} alt={value.name} />
              <figcaption>{value.name}</figcaption>
              <button type="button" className="icon-button ghost" onClick={() => commit('')} title="Clear image" aria-label="Clear image">
                <X size={14} />
              </button>
            </figure>
          ) : (
            <label className="image-drop">
              <ImageIcon size={16} />
              <span>Paste or upload</span>
              <input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => void commitImage(event.target.files?.[0])} />
            </label>
          )}
        </div>
      )
    case 'link':
      return (
        <label className="link-cell">
          <Link size={14} aria-hidden="true" />
          <input className="cell-input" type="url" value={typeof value === 'string' ? value : ''} onChange={(event) => commit(event.target.value)} />
        </label>
      )
    case 'text':
      return <textarea className="cell-input text-cell" value={typeof value === 'string' ? value : ''} onChange={(event) => commit(event.target.value)} />
  }
}
