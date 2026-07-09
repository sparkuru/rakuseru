import { AlertTriangle, Plus, Sheet, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { exportCsv } from '../adapters/exportCsv'
import { exportJson } from '../adapters/exportJson'
import { exportMarkdown } from '../adapters/exportMarkdown'
import { exportXlsxBlob } from '../adapters/exportXlsx'
import { importJson } from '../adapters/importJson'
import { COLUMN_TYPES, COLUMN_TYPE_LABELS } from '../model/column'
import type { ValidationIssue } from '../model/contentValidation'
import { useSheetStore } from '../state/sheetStore'
import { downloadBlob, downloadText } from '../utils/download'
import { ExportPreviewDialog, type ExportFormat } from './ExportPreviewDialog'

type ToolbarProps = {
  statusLabel: string
  validationIssues: ValidationIssue[]
}

export function Toolbar({ statusLabel, validationIssues }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const document = useSheetStore((state) => state.document)
  const setTitle = useSheetStore((state) => state.setTitle)
  const addColumn = useSheetStore((state) => state.addColumn)
  const addRow = useSheetStore((state) => state.addRow)
  const setDocument = useSheetStore((state) => state.setDocument)
  const setError = useSheetStore((state) => state.setError)
  const selectCell = useSheetStore((state) => state.selectCell)

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

  async function handleExport(format: ExportFormat): Promise<void> {
    switch (format) {
      case 'csv':
        downloadText(`${document.title}.csv`, exportCsv(document), 'text/csv')
        return
      case 'json':
        downloadText(`${document.title}.json`, exportJson(document), 'application/json')
        return
      case 'markdown':
        downloadText(`${document.title}.md`, exportMarkdown(document), 'text/markdown')
        return
      case 'excel':
        downloadBlob(`${document.title}.xlsx`, await exportXlsxBlob(document))
        return
    }
  }

  function handleSelectIssue(issue: ValidationIssue) {
    if (issue.rowId && issue.columnId) {
      selectCell(issue.rowId, issue.columnId)
      setIsPreviewOpen(false)
    }
  }

  return (
    <>
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
          <div className="action-group" aria-label="Structure actions">
            <button type="button" className="text-icon-button" onClick={addRow} title="Add row" aria-label="Add row">
              <Plus size={18} />
              <span>Row</span>
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
                  {COLUMN_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event.target.files?.[0])} />
          <div className="action-group" aria-label="Import actions">
            <button type="button" className="text-icon-button" onClick={() => fileInputRef.current?.click()} title="导入 JSON" aria-label="导入 JSON">
              <Upload size={18} />
              <span>导入 JSON</span>
            </button>
          </div>

          <div className="action-group" aria-label="Export actions">
            <button type="button" className={validationIssues.length > 0 ? 'text-icon-button validation-button has-issues' : 'text-icon-button validation-button'} onClick={() => setIsPreviewOpen(true)} title="校验" aria-label="校验">
              <AlertTriangle size={18} />
              <span>{validationIssues.length > 0 ? `校验 ${validationIssues.length}` : '校验'}</span>
            </button>
            <select
              className="compact-select"
              aria-label="选择导出格式"
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="excel">Excel</option>
            </select>
            <button type="button" className="primary-button" onClick={() => setIsPreviewOpen(true)} title="导出" aria-label="导出">
              导出
            </button>
          </div>
        </div>
      </header>

      {isPreviewOpen && (
        <ExportPreviewDialog
          document={document}
          format={exportFormat}
          validationIssues={validationIssues}
          onClose={() => setIsPreviewOpen(false)}
          onConfirm={handleExport}
          onSelectIssue={handleSelectIssue}
        />
      )}
    </>
  )
}
