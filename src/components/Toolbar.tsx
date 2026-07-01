import { Download, FileDown, FileJson, Plus, Sheet, Upload } from 'lucide-react'
import { useRef } from 'react'

import { exportCsv } from '../adapters/exportCsv'
import { exportJson } from '../adapters/exportJson'
import { exportMarkdown } from '../adapters/exportMarkdown'
import { exportXlsxBlob } from '../adapters/exportXlsx'
import { importJson } from '../adapters/importJson'
import { COLUMN_TYPES } from '../model/column'
import { useSheetStore } from '../state/sheetStore'
import { downloadBlob, downloadText } from '../utils/download'

type ToolbarProps = {
  statusLabel: string
}

export function Toolbar({ statusLabel }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const document = useSheetStore((state) => state.document)
  const setTitle = useSheetStore((state) => state.setTitle)
  const addColumn = useSheetStore((state) => state.addColumn)
  const addRow = useSheetStore((state) => state.addRow)
  const setDocument = useSheetStore((state) => state.setDocument)
  const setError = useSheetStore((state) => state.setError)

  async function handleImport(file: File | undefined) {
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      setDocument(importJson(content), `Imported ${file.name}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : `Could not import ${file.name}`)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <header className="toolbar">
      <div className="brand-lockup">
        <Sheet size={24} aria-hidden="true" />
        <div>
          <span className="brand">Rakuseru</span>
          <span className="status-line">{statusLabel}</span>
        </div>
      </div>

      <label className="title-field">
        <span>Title</span>
        <input value={document.title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <div className="toolbar-actions" aria-label="Sheet actions">
        <button type="button" className="icon-button" onClick={addRow} title="Add row" aria-label="Add row">
          <Plus size={18} />
        </button>
        <select
          className="compact-select"
          aria-label="Add column type"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) {
              addColumn(event.target.value as (typeof COLUMN_TYPES)[number])
              event.target.value = ''
            }
          }}
        >
          <option value="" disabled>
            Add column
          </option>
          {COLUMN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event.target.files?.[0])} />
        <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} title="Import JSON" aria-label="Import JSON">
          <Upload size={18} />
        </button>
        <button type="button" className="icon-button" onClick={() => downloadText(`${document.title}.json`, exportJson(document), 'application/json')} title="Export JSON" aria-label="Export JSON">
          <FileJson size={18} />
        </button>
        <button type="button" className="icon-button" onClick={() => downloadText(`${document.title}.md`, exportMarkdown(document), 'text/markdown')} title="Export Markdown" aria-label="Export Markdown">
          <FileDown size={18} />
        </button>
        <button type="button" className="icon-button" onClick={() => downloadText(`${document.title}.csv`, exportCsv(document), 'text/csv')} title="Export CSV" aria-label="Export CSV">
          <Download size={18} />
        </button>
        <button type="button" className="primary-button" onClick={() => void exportXlsxBlob(document).then((blob) => downloadBlob(`${document.title}.xlsx`, blob))}>
          XLSX
        </button>
      </div>
    </header>
  )
}
