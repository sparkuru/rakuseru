import { ChevronsRight, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { COLUMN_TYPES, COLUMN_TYPE_LABELS } from '../model/column'
import type { ColumnType } from '../model/document'
import { useSheetStore } from '../state/sheetStore'

export function ColumnSchemaPanel() {
  const [newOption, setNewOption] = useState('')
  const [confirmDeleteColumnId, setConfirmDeleteColumnId] = useState<string>()
  const document = useSheetStore((state) => state.document)
  const selectedColumnId = useSheetStore((state) => state.selectedColumnId)
  const updateColumn = useSheetStore((state) => state.updateColumn)
  const removeColumn = useSheetStore((state) => state.removeColumn)
  const toggleSidePanel = useSheetStore((state) => state.toggleSidePanel)
  const selectedColumn = document.columns.find((column) => column.id === selectedColumnId) ?? document.columns[0]

  if (!selectedColumn) {
    return <aside className="schema-panel">没有列</aside>
  }

  const confirmDelete = confirmDeleteColumnId === selectedColumn.id
  const isSelectColumn = selectedColumn.type === 'singleSelect' || selectedColumn.type === 'multiSelect'

  function updateOptions(options: string[]) {
    updateColumn(selectedColumn.id, {
      options: Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))),
    })
  }

  function addOption() {
    const option = newOption.trim()
    if (!option) {
      return
    }

    updateOptions([...(selectedColumn.options ?? []), option])
    setNewOption('')
  }

  return (
    <aside className="schema-panel" aria-label="Column schema editor">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">列属性</span>
          <h2>{selectedColumn.title}</h2>
        </div>
        <button type="button" className="icon-button ghost" onClick={toggleSidePanel} title="收起右侧面板" aria-label="收起右侧面板">
          <ChevronsRight size={16} />
        </button>
      </div>

      <section className="panel-section" aria-label="Column identity">
        <label className="field">
          <span>列名</span>
          <input value={selectedColumn.title} onChange={(event) => updateColumn(selectedColumn.id, { title: event.target.value })} />
        </label>

        <label className="field">
          <span>类型</span>
          <select value={selectedColumn.type} onChange={(event) => updateColumn(selectedColumn.id, { type: event.target.value as ColumnType })}>
            {COLUMN_TYPES.map((type) => (
              <option key={type} value={type}>
                {COLUMN_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      </section>

      {isSelectColumn && (
        <section className="panel-section" aria-label="Column options">
          <div className="field">
            <span>选项</span>
            <div className="option-list">
              {(selectedColumn.options ?? []).map((option, index) => (
                <div key={`${option}-${index}`} className="option-row">
                  <input
                    aria-label={`Option ${index + 1}`}
                    value={option}
                    onChange={(event) => {
                      const options = [...(selectedColumn.options ?? [])]
                      options[index] = event.target.value
                      updateOptions(options)
                    }}
                  />
                  <button type="button" className="icon-button ghost" onClick={() => updateOptions((selectedColumn.options ?? []).filter((_, optionIndex) => optionIndex !== index))} title="Delete option" aria-label="Delete option">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(selectedColumn.options ?? []).length === 0 && <p className="panel-note">添加选项后，单元格会显示可选值。</p>}
            </div>
            <div className="option-row">
              <input
                aria-label="New option"
                placeholder="输入新选项"
                value={newOption}
                onChange={(event) => setNewOption(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addOption()
                  }
                }}
              />
              <button type="button" className="text-button" onClick={addOption}>
                <Plus size={14} />
                添加
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel-section" aria-label="Column layout">
        <div className="two-column-fields">
          <label className="field">
            <span>宽度</span>
            <input type="number" value={selectedColumn.width ?? 160} onChange={(event) => updateColumn(selectedColumn.id, { width: Number(event.target.value) })} />
          </label>
          <label className="toggle-field">
            <input type="checkbox" checked={Boolean(selectedColumn.lockedWidth)} onChange={(event) => updateColumn(selectedColumn.id, { lockedWidth: event.target.checked })} />
            <span className="toggle-switch" aria-hidden="true" />
            <span>锁定宽度</span>
          </label>
        </div>
        <label className="toggle-field">
          <input type="checkbox" checked={Boolean(selectedColumn.wrap)} onChange={(event) => updateColumn(selectedColumn.id, { wrap: event.target.checked })} />
          <span className="toggle-switch" aria-hidden="true" />
          <span>自动换行</span>
        </label>
      </section>

      <section className="panel-section" aria-label="Column behavior">
        <label className="toggle-field">
          <input type="checkbox" checked={Boolean(selectedColumn.required)} onChange={(event) => updateColumn(selectedColumn.id, { required: event.target.checked })} />
          <span className="toggle-switch" aria-hidden="true" />
          <span>必填</span>
        </label>
      </section>

      <section className="panel-section danger-zone" aria-label="Danger zone">
        {confirmDelete ? (
          <div className="confirm-row">
            <span>删除这个列？</span>
            <button
              type="button"
              className="danger-text-button"
              onClick={() => {
                setConfirmDeleteColumnId(undefined)
                removeColumn(selectedColumn.id)
              }}
            >
              删除
            </button>
            <button type="button" className="text-button" onClick={() => setConfirmDeleteColumnId(undefined)}>
              取消
            </button>
          </div>
        ) : (
          <button type="button" className="danger-action" onClick={() => setConfirmDeleteColumnId(selectedColumn.id)} title="删除列" aria-label="删除列">
            <Trash2 size={16} />
            <span>删除列</span>
          </button>
        )}
      </section>
    </aside>
  )
}
