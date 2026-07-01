import { Trash2 } from 'lucide-react'

import { COLUMN_TYPES } from '../model/column'
import type { ColumnType } from '../model/document'
import { useSheetStore } from '../state/sheetStore'

export function HeaderEditor() {
  const document = useSheetStore((state) => state.document)
  const selectedColumnId = useSheetStore((state) => state.selectedColumnId)
  const selectColumn = useSheetStore((state) => state.selectColumn)
  const updateColumn = useSheetStore((state) => state.updateColumn)
  const removeColumn = useSheetStore((state) => state.removeColumn)
  const selectedColumn = document.columns.find((column) => column.id === selectedColumnId) ?? document.columns[0]

  if (!selectedColumn) {
    return <aside className="schema-panel">No columns</aside>
  }

  return (
    <aside className="schema-panel" aria-label="Column schema editor">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Column schema</span>
          <h2>{selectedColumn.title}</h2>
        </div>
        <button type="button" className="icon-button danger" onClick={() => removeColumn(selectedColumn.id)} title="Delete column" aria-label="Delete column">
          <Trash2 size={16} />
        </button>
      </div>

      <label className="field">
        <span>Selected column</span>
        <select value={selectedColumn.id} onChange={(event) => selectColumn(event.target.value)}>
          {document.columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Title</span>
        <input value={selectedColumn.title} onChange={(event) => updateColumn(selectedColumn.id, { title: event.target.value })} />
      </label>

      <label className="field">
        <span>Type</span>
        <select value={selectedColumn.type} onChange={(event) => updateColumn(selectedColumn.id, { type: event.target.value as ColumnType })}>
          {COLUMN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {(selectedColumn.type === 'singleSelect' || selectedColumn.type === 'multiSelect') && (
        <label className="field">
          <span>Options</span>
          <textarea
            value={(selectedColumn.options ?? []).join('\n')}
            onChange={(event) =>
              updateColumn(selectedColumn.id, {
                options: event.target.value
                  .split('\n')
                  .map((option) => option.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      )}

      <div className="two-column-fields">
        <label className="field">
          <span>Width</span>
          <input type="number" value={selectedColumn.width ?? 160} onChange={(event) => updateColumn(selectedColumn.id, { width: Number(event.target.value) })} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={Boolean(selectedColumn.lockedWidth)} onChange={(event) => updateColumn(selectedColumn.id, { lockedWidth: event.target.checked })} />
          <span>Lock width</span>
        </label>
      </div>

      <label className="checkbox-field">
        <input type="checkbox" checked={Boolean(selectedColumn.required)} onChange={(event) => updateColumn(selectedColumn.id, { required: event.target.checked })} />
        <span>Required</span>
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={Boolean(selectedColumn.wrap)} onChange={(event) => updateColumn(selectedColumn.id, { wrap: event.target.checked })} />
        <span>Wrap text</span>
      </label>
    </aside>
  )
}
