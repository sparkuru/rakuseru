import { AlertTriangle, Check, Download, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { exportCsv } from '../adapters/exportCsv'
import { exportHtml } from '../adapters/exportHtml'
import { exportJson } from '../adapters/exportJson'
import { exportMarkdown } from '../adapters/exportMarkdown'
import { documentHasImages, stringifyCellValue } from '../model/cell'
import type { ValidationIssue } from '../model/contentValidation'
import type { SheetDocument } from '../model/document'

export type ExportFormat = 'csv' | 'json' | 'markdown' | 'html' | 'excel'

type ExportPreviewDialogProps = {
  document: SheetDocument
  format: ExportFormat
  validationIssues: ValidationIssue[]
  onClose: () => void
  onConfirm: (format: ExportFormat, previewHtml?: string) => Promise<void>
  onSelectIssue: (issue: ValidationIssue) => void
}

const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  markdown: 'Markdown',
  html: 'HTML',
  excel: 'Excel',
}

export function ExportPreviewDialog({ document, format, validationIssues, onClose, onConfirm, onSelectIssue }: ExportPreviewDialogProps) {
  const [isExporting, setIsExporting] = useState(false)
  const hasImages = documentHasImages(document)
  const previewText = useMemo(() => createPreviewText(document, format, hasImages), [document, format, hasImages])
  const previewHtml = useMemo(() => (format === 'html' ? exportHtml(document) : ''), [document, format])
  const showTablePreview = format === 'csv' || format === 'markdown' || format === 'excel'

  async function confirmExport() {
    setIsExporting(true)
    try {
      await onConfirm(format, previewHtml)
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
            <h2 id="export-preview-title">{format === 'json' && hasImages ? 'JSON ZIP' : EXPORT_FORMAT_LABELS[format]}</h2>
          </div>
          <button type="button" className="icon-button ghost" onClick={onClose} title="关闭预览" aria-label="关闭预览">
            <X size={16} />
          </button>
        </div>

        <div className="preview-dialog-body">
          <section className="preview-output" aria-label="导出内容预览">
            <div className="preview-section-heading">
              <Download size={16} aria-hidden="true" />
              <h3>内容预览</h3>
              <span>{format === 'excel' ? '表格近似预览' : format === 'html' ? '报告预览' : '源内容'}</span>
            </div>
            {format === 'html' ? (
              <iframe className="preview-html-frame" title="HTML report preview" sandbox="allow-popups" srcDoc={previewHtml} />
            ) : (
              <>
                {showTablePreview && <PreviewTable document={document} />}
                {previewText && <pre className="preview-code">{previewText}</pre>}
              </>
            )}
          </section>

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

function createPreviewText(document: SheetDocument, format: ExportFormat, hasImages: boolean): string {
  switch (format) {
    case 'csv':
      return exportCsv(document)
    case 'json':
      if (hasImages) {
        return '当前清单包含图片。确认导出后将下载包含 JSON manifest 与 img/ 图片目录的 ZIP 档案。'
      }
      return exportJson(document)
    case 'markdown':
      return exportMarkdown(document)
    case 'html':
      return ''
    case 'excel':
      return ''
  }
}
