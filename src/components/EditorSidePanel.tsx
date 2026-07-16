import { Check, ChevronsLeft, ChevronsRight, ExternalLink, Image as ImageIcon, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'

import { createEmptyCellValue, isImageValue, stringifyCellValue } from '../model/cell'
import { COLUMN_TYPE_LABELS } from '../model/column'
import type { CellValue, ColumnDef, ImageCellValue, ImageFit, RowData } from '../model/document'
import { useSheetStore } from '../state/sheetStore'
import { readImageFile } from '../utils/image'
import { ColumnSchemaPanel } from './HeaderEditor'

const IMAGE_FIT_LABELS: Record<ImageFit, string> = {
  contain: '完整显示',
  cover: '占满表格',
  fill: '拉伸',
  center: '居中',
}

const IMAGE_FITS: ImageFit[] = ['contain', 'cover', 'fill', 'center']

export function EditorSidePanel() {
  const document = useSheetStore((state) => state.document)
  const rightPanelMode = useSheetStore((state) => state.rightPanelMode)
  const sidePanelCollapsed = useSheetStore((state) => state.sidePanelCollapsed)
  const toggleSidePanel = useSheetStore((state) => state.toggleSidePanel)

  if (sidePanelCollapsed) {
    return (
      <aside className="schema-panel collapsed-panel" aria-label="Editor panel collapsed">
        <button type="button" className="icon-button ghost" onClick={toggleSidePanel} title="展开右侧面板" aria-label="展开右侧面板">
          <ChevronsLeft size={16} />
        </button>
      </aside>
    )
  }

  if (rightPanelMode.kind === 'column') {
    return <ColumnSchemaPanel />
  }

  if (rightPanelMode.kind === 'cell') {
    const row = document.rows.find((candidate) => candidate.id === rightPanelMode.rowId)
    const column = document.columns.find((candidate) => candidate.id === rightPanelMode.columnId)

    if (row && column) {
      return <CellValuePanel key={`${row.id}:${column.id}`} row={row} column={column} />
    }
  }

  return (
    <aside className="schema-panel empty-panel" aria-label="Editor panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">编辑面板</span>
          <h2>选择内容</h2>
        </div>
        <button type="button" className="icon-button ghost" onClick={toggleSidePanel} title="收起右侧面板" aria-label="收起右侧面板">
          <ChevronsRight size={16} />
        </button>
      </div>
      <p className="panel-note">点击表头编辑列属性；点击单元格编辑内容。</p>
    </aside>
  )
}

type CellValuePanelProps = {
  row: RowData
  column: ColumnDef
}

function CellValuePanel({ row, column }: CellValuePanelProps) {
  const updateCell = useSheetStore((state) => state.updateCell)
  const selectColumn = useSheetStore((state) => state.selectColumn)
  const toggleSidePanel = useSheetStore((state) => state.toggleSidePanel)
  const value = row.cells[column.id] ?? createEmptyCellValue(column)
  const [draft, setDraft] = useState(() => stringifyCellValue(value))
  const [imageDraft, setImageDraft] = useState<ImageCellValue | ''>(() => (isImageValue(value) ? value : ''))

  function commit(nextValue: CellValue) {
    updateCell(row.id, column.id, nextValue)
  }

  function commitDraft() {
    if (column.type === 'number' || column.type === 'money') {
      commit(Number(draft) || 0)
      return
    }

    commit(draft)
  }

  function clearValue() {
    const emptyValue = createEmptyCellValue(column)
    setDraft(stringifyCellValue(emptyValue))
    setImageDraft('')
    commit(emptyValue)
  }

  const updateImage = useCallback(async (file: File | undefined) => {
    if (!file) {
      return
    }

    setImageDraft({ ...(await readImageFile(file)), fit: 'contain' })
  }, [])

  useEffect(() => {
    if (column.type !== 'image') {
      return
    }

    function handlePaste(event: ClipboardEvent) {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'))
      if (!image) {
        return
      }

      event.preventDefault()
      void updateImage(image)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [column.type, updateImage])

  function saveImage() {
    commit(imageDraft)
  }

  return (
    <aside className="schema-panel" aria-label="Cell editor">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">单元格</span>
          <h2>{column.title}</h2>
        </div>
        <button type="button" className="icon-button ghost" onClick={toggleSidePanel} title="收起右侧面板" aria-label="收起右侧面板">
          <ChevronsRight size={16} />
        </button>
      </div>

      <section className="panel-section" aria-label="Cell identity">
        <div className="meta-row">
          <span>类型</span>
          <strong>{COLUMN_TYPE_LABELS[column.type]}</strong>
        </div>
        <div className="meta-row">
          <span>列</span>
          <strong>{column.title}</strong>
        </div>
      </section>

      {renderEditor()}
    </aside>
  )

  function renderEditor() {
    switch (column.type) {
      case 'text':
        return (
          <section className="panel-section" aria-label="Text cell editor">
            <label className="field">
              <span>内容</span>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} />
            </label>
            <PanelActions onSave={commitDraft} onClear={clearValue} />
          </section>
        )
      case 'link':
        return (
          <section className="panel-section" aria-label="Link cell editor">
            <label className="field">
              <span>链接</span>
              <input type="url" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} />
            </label>
            <div className="panel-actions">
              {draft && (
                <a className="text-button" href={draft} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                  打开
                </a>
              )}
              <button type="button" className="text-button" onClick={clearValue}>
                <X size={14} />
                清空
              </button>
              <button type="button" className="primary-button" onClick={commitDraft}>
                <Check size={14} />
                确认
              </button>
            </div>
          </section>
        )
      case 'number':
      case 'money':
        return (
          <section className="panel-section" aria-label="Numeric cell editor">
            <label className="field">
              <span>数值</span>
              <input type="number" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} />
            </label>
            <PanelActions onSave={commitDraft} onClear={clearValue} />
          </section>
        )
      case 'image':
        return (
          <section className="panel-section" aria-label="Image cell editor">
            <label className="image-panel-drop">
              <ImageIcon size={18} />
              <span>{imageDraft ? '替换图片' : '上传或粘贴图片'}</span>
              <input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => void updateImage(event.target.files?.[0])} />
            </label>
            {imageDraft ? (
              <>
                <figure className={`image-panel-preview fit-${imageDraft.fit ?? 'contain'}`}>
                  <img src={imageDraft.dataUrl} alt={imageDraft.name} />
                  <figcaption title={imageDraft.name}>{imageDraft.name}</figcaption>
                </figure>
                <label className="field">
                  <span>展示方式</span>
                  <select value={imageDraft.fit ?? 'contain'} onChange={(event) => setImageDraft({ ...imageDraft, fit: event.target.value as ImageFit })}>
                    {IMAGE_FITS.map((fit) => (
                      <option key={fit} value={fit}>
                        {IMAGE_FIT_LABELS[fit]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="panel-note">裁剪和旋转会作为后续图片编辑增强。</p>
              </>
            ) : (
              <p className="panel-note">可选择图片，或直接按 Ctrl/⌘ + V 粘贴剪贴板图片。</p>
            )}
            <div className="panel-actions">
              <button type="button" className="text-button" onClick={clearValue}>
                <X size={14} />
                清空
              </button>
              <button type="button" className="primary-button" onClick={saveImage}>
                <Check size={14} />
                确认
              </button>
            </div>
          </section>
        )
      case 'singleSelect':
      case 'multiSelect':
        return (
          <section className="panel-section" aria-label="Select cell guidance">
            {(column.options ?? []).length > 0 ? (
              <p className="panel-note">此类型可直接在表格单元格中选择。</p>
            ) : (
              <>
                <p className="panel-note">这个列还没有选项。先配置选项后，单元格会显示可选值。</p>
                <button type="button" className="text-button" onClick={() => selectColumn(column.id)}>
                  配置列选项
                </button>
              </>
            )}
          </section>
        )
    }
  }
}

type PanelActionsProps = {
  onSave: () => void
  onClear: () => void
}

function PanelActions({ onSave, onClear }: PanelActionsProps) {
  return (
    <div className="panel-actions">
      <button type="button" className="text-button" onClick={onClear}>
        <X size={14} />
        清空
      </button>
      <button type="button" className="primary-button" onClick={onSave}>
        <Check size={14} />
        确认
      </button>
    </div>
  )
}
