import { AlertTriangle, Check, Download, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { exportCsv } from '../adapters/exportCsv'
import { exportJson } from '../adapters/exportJson'
import { exportMarkdown } from '../adapters/exportMarkdown'
import { stringifyCellValue } from '../model/cell'
import type { ValidationIssue } from '../model/contentValidation'
import type { SheetDocument } from '../model/document'

export type ExportFormat = 'csv' | 'json' | 'markdown' | 'excel'

type ExportPreviewDialogProps = {
  document: SheetDocument
  format: ExportFormat
  validationIssues: ValidationIssue[]
  onClose: () => void
  onConfirm: (format: ExportFormat) => Promise<void>
  onSelectIssue: (issue: ValidationIssue) => void
}

const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  markdown: 'Markdown',
  excel: 'Excel',
}

export function ExportPreviewDialog({ document, format, validationIssues, onClose, onConfirm, onSelectIssue }: ExportPreviewDialogProps) {
  const [isExporting, setIsExporting] = useState(false)
  const previewText = useMemo(() => createPreviewText(document, format), [document, format])
  const showTablePreview = format === 'csv' || format === 'markdown' || format === 'excel'

  async function confirmExport() {
    setIsExporting(true)
    try {
      await onConfirm(format)
      onClose()
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="export-preview-title">
        <div className="preview-dialog-heading">
          <div>
            <span className="panel-kicker">导出预览</span>
            <h2 id="export-preview-title">{EXPORT_FORMAT_LABELS[format]}</h2>
          </div>
          <button type="button" className="icon-button ghost" onClick={onClose} title="关闭预览" aria-label="关闭预览">
            <X size={16} />
          </button>
        </div>

        <div className="preview-dialog-body">
          <section className={validationIssues.length > 0 ? 'preview-issues has-issues' : 'preview-issues'} aria-label="校验结果">
            <div className="preview-section-heading">
              <AlertTriangle size={16} aria-hidden="true" />
              <h3>校验结果</h3>
              <span>{validationIssues.length > 0 ? `${validationIssues.length} 个问题` : '无问题'}</span>
            </div>
            {validationIssues.length > 0 ? (
              <div className="issue-list">
                {validationIssues.map((issue) => (
                  <button key={issue.id} type="button" className={`issue-row ${issue.severity}`} onClick={() => onSelectIssue(issue)}>
                    <span>{issue.locationLabel}</span>
                    <strong>{issue.message}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="panel-note">当前没有发现导出前需要注意的校验问题。</p>
            )}
          </section>

          <section className="preview-output" aria-label="导出内容预览">
            <div className="preview-section-heading">
              <Download size={16} aria-hidden="true" />
              <h3>内容预览</h3>
              <span>{format === 'excel' ? '表格近似预览' : '源内容'}</span>
            </div>
            {showTablePreview && <PreviewTable document={document} />}
            {previewText && <pre className="preview-code">{previewText}</pre>}
          </section>
        </div>

        <div className="preview-dialog-actions">
          <button type="button" className="text-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={() => void confirmExport()} disabled={isExporting}>
            <Check size={14} />
            {isExporting ? '导出中' : validationIssues.length > 0 ? '确认导出' : '导出'}
          </button>
        </div>
      </section>
    </div>
  )
}

function PreviewTable({ document }: { document: SheetDocument }) {
  return (
    <div className="preview-table-wrap">
      <table className="preview-table">
        <thead>
          <tr>
            {document.columns.map((column) => (
              <th key={column.id}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {document.rows.map((row) => (
            <tr key={row.id}>
              {document.columns.map((column) => (
                <td key={column.id}>{stringifyCellValue(row.cells[column.id] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function createPreviewText(document: SheetDocument, format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return exportCsv(document)
    case 'json':
      return exportJson(document)
    case 'markdown':
      return exportMarkdown(document)
    case 'excel':
      return ''
  }
}
