import { AlertTriangle, Copy, FilePlus, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { exportCsv } from '../adapters/exportCsv'
import { exportHtml } from '../adapters/exportHtml'
import { exportJson } from '../adapters/exportJson'
import { exportJsonZipBlob, importJsonZip } from '../adapters/jsonZip'
import { exportMarkdown } from '../adapters/exportMarkdown'
import { exportXlsxBlob } from '../adapters/exportXlsx'
import { importHtml } from '../adapters/importHtml'
import { importJson } from '../adapters/importJson'
import { COLUMN_TYPES, COLUMN_TYPE_LABELS } from '../model/column'
import { documentHasImages } from '../model/cell'
import type { ValidationIssue } from '../model/contentValidation'
import { useSheetStore } from '../state/sheetStore'
import { downloadBlob, downloadText } from '../utils/download'
import { ExportPreviewDialog, type ExportFormat } from './ExportPreviewDialog'

type ToolbarProps = {
  validationIssues: ValidationIssue[]
}

export function Toolbar({ validationIssues }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('html')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const documents = useSheetStore((state) => state.documents)
  const activeDocumentId = useSheetStore((state) => state.activeDocumentId)
  const document = useSheetStore((state) => state.document)
  const hasImages = documentHasImages(document)
  const activeExportFormat = hasImages && (exportFormat === 'csv' || exportFormat === 'markdown') ? 'html' : exportFormat
  const setTitle = useSheetStore((state) => state.setTitle)
  const addColumn = useSheetStore((state) => state.addColumn)
  const addRow = useSheetStore((state) => state.addRow)
  const createDocument = useSheetStore((state) => state.createDocument)
  const duplicateDocument = useSheetStore((state) => state.duplicateDocument)
  const switchDocument = useSheetStore((state) => state.switchDocument)
  const deleteDocument = useSheetStore((state) => state.deleteDocument)
  const importDocumentAsNew = useSheetStore((state) => state.importDocumentAsNew)
  const setError = useSheetStore((state) => state.setError)
  const selectCell = useSheetStore((state) => state.selectCell)

  async function handleImport(file: File | undefined) {
    if (!file) {
      return
    }

    try {
      const filename = file.name.toLowerCase()
      const importedDocument = filename.endsWith('.zip')
        ? await importJsonZip(await file.arrayBuffer())
        : filename.endsWith('.html')
          ? importHtml(await file.text())
          : importJson(await file.text())
      importDocumentAsNew(importedDocument, `Imported ${file.name}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : `Could not import ${file.name}`)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleExport(format: ExportFormat, previewHtml?: string): Promise<void> {
    switch (format) {
      case 'csv':
        downloadText(`${document.title}.csv`, exportCsv(document), 'text/csv')
        return
      case 'json':
        if (hasImages) {
          downloadBlob(`${document.title}.zip`, await exportJsonZipBlob(document))
          return
        }
        downloadText(`${document.title}.json`, exportJson(document), 'application/json')
        return
      case 'markdown':
        downloadText(`${document.title}.md`, exportMarkdown(document), 'text/markdown')
        return
      case 'html':
        downloadText(`${document.title}.html`, previewHtml ?? exportHtml(document), 'text/html')
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

  function handleDeleteDocument() {
    const title = document.title.trim() || '当前清单'
    if (window.confirm(`删除「${title}」？此操作只会删除浏览器本地清单。`)) {
      deleteDocument(activeDocumentId)
    }
  }

  function handleAddAction(value: string) {
    if (value === 'row') {
      addRow()
      return
    }

    const columnType = COLUMN_TYPES.find((type) => value === `column:${type}`)
    if (columnType) {
      addColumn(columnType)
    }
  }

  function handleMoreAction(value: string) {
    switch (value) {
      case 'duplicate':
        duplicateDocument()
        return
      case 'delete':
        handleDeleteDocument()
        return
      case 'import':
        fileInputRef.current?.click()
        return
      case 'validate':
        setIsPreviewOpen(true)
    }
  }

  return (
    <>
      <header className="toolbar">
        <label className="title-field">
          <span>Title</span>
          <input aria-label="清单标题" value={document.title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <div className="toolbar-actions" aria-label="Sheet actions">
          <div className="action-group document-action-group" aria-label="Document library actions">
            <select
              className="compact-select document-select"
              aria-label="当前清单"
              value={activeDocumentId}
              onChange={(event) => {
                void switchDocument(event.target.value)
              }}
            >
              {documents.map((summary) => (
                <option key={summary.id} value={summary.id}>
                  {summary.title}
                </option>
              ))}
            </select>
            <button type="button" className="text-icon-button compact-text-button" onClick={createDocument} title="新建清单" aria-label="新建清单">
              <FilePlus size={18} />
              <span className="document-create-label">新建</span>
            </button>
            <button type="button" className="icon-button document-secondary-action" onClick={duplicateDocument} title="复制当前清单" aria-label="复制当前清单">
              <Copy size={18} />
            </button>
            <button type="button" className="icon-button danger document-secondary-action" onClick={handleDeleteDocument} title="删除当前清单" aria-label="删除当前清单">
              <Trash2 size={18} />
            </button>
          </div>

          <div className="action-group toolbar-wide-only" aria-label="Structure actions">
            <button type="button" className="text-icon-button" onClick={addRow} title="添加行" aria-label="添加行">
              <Plus size={16} />
              <span>添加行</span>
            </button>
            <select
              className="compact-select"
              aria-label="添加列类型"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  addColumn(event.target.value as (typeof COLUMN_TYPES)[number])
                  event.target.value = ''
                }
              }}
            >
              <option value="" disabled>
                添加列
              </option>
              {COLUMN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {COLUMN_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="action-group toolbar-compact-only" aria-label="添加内容">
            <select
              className="compact-select add-menu-select"
              aria-label="添加内容"
              defaultValue=""
              onChange={(event) => {
                handleAddAction(event.target.value)
                event.target.value = ''
              }}
            >
              <option value="" disabled>
                ＋ 添加
              </option>
              <option value="row">添加行</option>
              <optgroup label="添加列">
                {COLUMN_TYPES.map((type) => (
                  <option key={type} value={`column:${type}`}>
                    {COLUMN_TYPE_LABELS[type]}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json,application/zip,.zip,text/html,.html" onChange={(event) => void handleImport(event.target.files?.[0])} />
          <div className="action-group toolbar-import-actions" aria-label="Import actions">
            <button type="button" className="text-icon-button toolbar-secondary-action" onClick={() => fileInputRef.current?.click()} title="导入 JSON、JSON ZIP 或 HTML 为新清单" aria-label="导入 JSON、JSON ZIP 或 HTML 为新清单">
              <Upload size={16} />
              <span className="toolbar-action-label">导入</span>
            </button>
          </div>

          <div className="action-group toolbar-export-actions" aria-label="Export actions">
            <button type="button" className={validationIssues.length > 0 ? 'text-icon-button validation-button has-issues toolbar-secondary-action' : 'text-icon-button validation-button toolbar-secondary-action'} onClick={() => setIsPreviewOpen(true)} title="校验" aria-label="校验">
              <AlertTriangle size={18} />
              <span className="toolbar-action-label">校验</span>
              {validationIssues.length > 0 && <span className="validation-count">{validationIssues.length}</span>}
            </button>
            <select
              className="compact-select"
              aria-label="选择导出格式"
              title={hasImages ? '当前清单含图片：CSV 和 Markdown 不支持图片导出。' : undefined}
              value={activeExportFormat}
              onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
            >
              <option value="csv" disabled={hasImages}>CSV{hasImages ? '（图片不支持）' : ''}</option>
              <option value="json">{hasImages ? 'JSON ZIP' : 'JSON'}</option>
              <option value="markdown" disabled={hasImages}>Markdown{hasImages ? '（图片不支持）' : ''}</option>
              <option value="html">HTML</option>
              <option value="excel">Excel</option>
            </select>
            <button type="button" className="primary-button" onClick={() => setIsPreviewOpen(true)} title="导出" aria-label="导出">
              导出
            </button>
          </div>

          <div className="action-group toolbar-more-actions" aria-label="更多操作">
            <select
              className="compact-select more-actions-select"
              aria-label="更多操作"
              defaultValue=""
              onChange={(event) => {
                handleMoreAction(event.target.value)
                event.target.value = ''
              }}
            >
              <option value="" disabled>
                更多
              </option>
              <option value="duplicate">复制当前清单</option>
              <option value="delete">删除当前清单</option>
              <option value="import">导入新清单</option>
              <option value="validate">{validationIssues.length > 0 ? `校验（${validationIssues.length} 个问题）` : '校验'}</option>
            </select>
          </div>
        </div>
      </header>

      {isPreviewOpen && (
        <ExportPreviewDialog
          document={document}
          format={activeExportFormat}
          validationIssues={validationIssues}
          onClose={() => setIsPreviewOpen(false)}
          onConfirm={handleExport}
          onSelectIssue={handleSelectIssue}
        />
      )}
    </>
  )
}
