import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { COLUMN_TYPES } from '../model/column'
import type { ColumnType } from '../model/document'
import { useSheetStore } from '../state/sheetStore'

export function HeaderEditor() {
  const [confirmDeleteColumnId, setConfirmDeleteColumnId] = useState<string>()
  const document = useSheetStore((state) => state.document)
  const selectedColumnId = useSheetStore((state) => state.selectedColumnId)
  const selectColumn = useSheetStore((state) => state.selectColumn)
  const updateColumn = useSheetStore((state) => state.updateColumn)
  const removeColumn = useSheetStore((state) => state.removeColumn)
  const selectedColumn = document.columns.find((column) => column.id === selectedColumnId) ?? document.columns[0]

  if (!selectedColumn) {
    return <aside className="schema-panel">No columns</aside>
  }

  const confirmDelete = confirmDeleteColumnId === selectedColumn.id

  return (
    <aside className="schema-panel" aria-label="Column schema editor">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Column schema</span>
          <h2>{selectedColumn.title}</h2>
        </div>
      </div>

      <section className="panel-section" aria-label="Column identity">
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
      </section>

      {(selectedColumn.type === 'singleSelect' || selectedColumn.type === 'multiSelect') && (
        <section className="panel-section" aria-label="Column options">
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
        </section>
      )}

      <section className="panel-section" aria-label="Column layout">
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
          <input type="checkbox" checked={Boolean(selectedColumn.wrap)} onChange={(event) => updateColumn(selectedColumn.id, { wrap: event.target.checked })} />
          <span>Wrap text</span>
        </label>
      </section>

      <section className="panel-section" aria-label="Column behavior">
        <label className="checkbox-field">
          <input type="checkbox" checked={Boolean(selectedColumn.required)} onChange={(event) => updateColumn(selectedColumn.id, { required: event.target.checked })} />
          <span>Required</span>
        </label>
      </section>

      <section className="panel-section danger-zone" aria-label="Danger zone">
        {confirmDelete ? (
          <div className="confirm-row">
            <span>Delete this column?</span>
            <button
              type="button"
              className="danger-text-button"
              onClick={() => {
                setConfirmDeleteColumnId(undefined)
                removeColumn(selectedColumn.id)
              }}
            >
              Delete
            </button>
            <button type="button" className="text-button" onClick={() => setConfirmDeleteColumnId(undefined)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="danger-action" onClick={() => setConfirmDeleteColumnId(selectedColumn.id)} title="Delete column" aria-label="Delete column">
            <Trash2 size={16} />
            <span>Delete column</span>
          </button>
        )}
      </section>
    </aside>
  )
}
