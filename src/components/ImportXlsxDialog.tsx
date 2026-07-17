import { AlertTriangle, Check, FileSpreadsheet, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  buildXlsxDocument,
  createXlsxColumnMappings,
  XLSX_MAPPABLE_COLUMN_TYPES,
  type XlsxColumnMapping,
  type XlsxImportWorkbook,
} from '../adapters/importXlsx'
import { COLUMN_TYPE_LABELS } from '../model/column'
import type { SheetDocument } from '../model/document'

type ImportXlsxDialogProps = {
  workbook: XlsxImportWorkbook
  onClose: () => void
  onConfirm: (document: SheetDocument) => void
}

export function ImportXlsxDialog({ workbook, onClose, onConfirm }: ImportXlsxDialogProps) {
  const initialSheet = workbook.sheets.find((sheet) => sheet.name === workbook.defaultSheetName) ?? workbook.sheets[0]
  const [selectedSheetName, setSelectedSheetName] = useState(initialSheet.name)
  const [documentTitle, setDocumentTitle] = useState(initialSheet.name)
  const [mappings, setMappings] = useState<XlsxColumnMapping[]>(() => createXlsxColumnMappings(initialSheet))
  const selectedSheet = workbook.sheets.find((sheet) => sheet.name === selectedSheetName) ?? initialSheet
  const result = useMemo(() => buildXlsxDocument(selectedSheet, mappings, documentTitle), [documentTitle, mappings, selectedSheet])
  const blockingIssues = result.issues.filter((issue) => issue.severity === 'error')
  const warnings = [...selectedSheet.warnings, ...result.issues.filter((issue) => issue.severity === 'warning')]

  function selectSheet(name: string) {
    const sheet = workbook.sheets.find((candidate) => candidate.name === name)
    if (!sheet) {
      return
    }

    setSelectedSheetName(sheet.name)
    setDocumentTitle(sheet.name)
    setMappings(createXlsxColumnMappings(sheet))
  }

  function updateMapping(sourceColumn: number, patch: Partial<XlsxColumnMapping>) {
    setMappings((current) => current.map((mapping) => (mapping.sourceColumn === sourceColumn ? { ...mapping, ...patch } : mapping)))
  }

  function confirmImport() {
    if (result.document) {
      onConfirm(result.document)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="preview-dialog import-xlsx-dialog" role="dialog" aria-modal="true" aria-labelledby="xlsx-import-title">
        <div className="preview-dialog-heading">
          <div>
            <span className="panel-kicker">导入 Excel</span>
            <h2 id="xlsx-import-title">确认列映射</h2>
          </div>
          <button type="button" className="icon-button ghost" onClick={onClose} title="取消导入" aria-label="取消导入">
            <X size={16} />
          </button>
        </div>

        <div className="preview-dialog-body import-xlsx-dialog-body">
          <section className="import-xlsx-settings" aria-label="Excel 导入设置">
            <label className="field">
              <span>工作表</span>
              <select value={selectedSheetName} onChange={(event) => selectSheet(event.target.value)}>
                {workbook.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name} disabled={sheet.columns.length === 0}>
                    {sheet.name}{sheet.columns.length === 0 ? '（无可导入数据）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>新清单标题</span>
              <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} />
            </label>
            <p className="panel-note">{selectedSheet.rowCount} 行数据，{selectedSheet.columns.length} 列。所有列默认导入为文本。</p>
          </section>

          <section className="import-xlsx-mappings" aria-label="列映射">
            <div className="preview-section-heading">
              <FileSpreadsheet size={16} aria-hidden="true" />
              <h3>列映射</h3>
              <span>修改后会立即校验</span>
            </div>
            <div className="import-xlsx-mapping-list">
              {selectedSheet.columns.map((column) => {
                const mapping = mappings.find((candidate) => candidate.sourceColumn === column.sourceColumn)
                if (!mapping) {
                  return null
                }

                return (
                  <div key={column.sourceColumn} className="import-xlsx-mapping-row">
                    <span className="import-xlsx-source-title" title={column.sourceTitle || '空白表头'}>{column.sourceTitle || '空白表头'}</span>
                    <label className="field">
                      <span className="visually-hidden">第 {column.sourceColumn} 列标题</span>
                      <input value={mapping.title} onChange={(event) => updateMapping(column.sourceColumn, { title: event.target.value })} aria-label={`第 ${column.sourceColumn} 列标题`} />
                    </label>
                    <label className="field">
                      <span className="visually-hidden">第 {column.sourceColumn} 列类型</span>
                      <select value={mapping.type} onChange={(event) => updateMapping(column.sourceColumn, { type: event.target.value as XlsxColumnMapping['type'] })} aria-label={`第 ${column.sourceColumn} 列类型`}>
                        {XLSX_MAPPABLE_COLUMN_TYPES.map((type) => (
                          <option key={type} value={type}>{COLUMN_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )
              })}
            </div>
          </section>

          <section className={blockingIssues.length > 0 ? 'preview-issues has-issues' : 'preview-issues'} aria-label="导入检查结果">
            <div className="preview-section-heading">
              <AlertTriangle size={16} aria-hidden="true" />
              <h3>导入检查</h3>
              <span>{blockingIssues.length > 0 ? `${blockingIssues.length} 个阻断问题` : warnings.length > 0 ? `${warnings.length} 个提示` : '可以导入'}</span>
            </div>
            {blockingIssues.length > 0 || warnings.length > 0 ? (
              <div className="issue-list">
                {[...blockingIssues, ...warnings].map((issue) => (
                  <div key={issue.id} className={`issue-row ${issue.severity}`}>
                    {issue.locationLabel && <span>{issue.locationLabel}</span>}
                    <strong>{issue.message}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-note">当前映射可以安全导入为新的本地清单。</p>
            )}
          </section>
        </div>

        <div className="preview-dialog-actions">
          <button type="button" className="text-button" onClick={onClose}>取消</button>
          <button type="button" className="primary-button" onClick={confirmImport} disabled={!result.document}>
            <Check size={14} />
            确认导入
          </button>
        </div>
      </section>
    </div>
  )
}
