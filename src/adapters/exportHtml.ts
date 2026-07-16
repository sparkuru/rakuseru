import { isImageValue, stringifyCellValue } from '../model/cell'
import { getColumnAlign } from '../model/column'
import type { CellValue, ColumnDef, RowData, SheetDocument } from '../model/document'

const PAYLOAD_ID = 'rakuseru-document'

export function exportHtml(document: SheetDocument, exportedAt = new Date()): string {
  const timestamp = exportedAt.toLocaleString()
  const canonicalPayload = JSON.stringify(document).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
  const rows = document.rows.map((row, rowIndex) => renderRow(row, document.columns, rowIndex)).join('')
  const imageLightboxes = renderImageLightboxes(document)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(document.title)}</title>
    <style>
      :root { color: #1f2933; background: #f3f6f7; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { box-sizing: border-box; width: 85vw; margin: 0 auto; padding: 40px 24px; }
      main { overflow: hidden; border: 1px solid #d9e0e5; border-radius: 10px; background: #fff; box-shadow: 0 12px 30px rgba(31, 41, 51, .08); }
      header { padding: 24px; border-bottom: 1px solid #e2e7eb; }
      h1 { margin: 0; font-size: 24px; line-height: 1.25; }
      .exported-at { margin: 8px 0 0; color: #66717d; font-size: 13px; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { min-width: 110px; border: 1px solid #e2e7eb; padding: 10px 12px; vertical-align: top; }
      th { color: #25313d; background: #eef3f2; font-weight: 700; text-align: left; }
      td img { display: block; width: 100%; min-width: 96px; max-width: 280px; height: 160px; border-radius: 4px; background: #f6f8f9; }
      .image-link { display: block; cursor: zoom-in; }
      .fit-contain { object-fit: contain; } .fit-cover { object-fit: cover; } .fit-fill { object-fit: fill; } .fit-center { object-fit: none; object-position: center; }
      a { color: #1769aa; overflow-wrap: anywhere; } .empty-cell { color: #8a959f; }
      .image-lightbox { position: fixed; inset: 0; z-index: 1; display: none; place-items: center; gap: 12px; padding: 28px; background: rgba(23, 31, 40, .88); }
      .image-lightbox:target { display: grid; }
      .image-lightbox figure { display: grid; justify-items: center; gap: 10px; max-width: min(92vw, 1600px); max-height: 88vh; margin: 0; color: #fff; }
      .image-lightbox img { display: block; max-width: 100%; max-height: calc(88vh - 72px); object-fit: contain; }
      .image-lightbox-close { border: 1px solid rgba(255, 255, 255, .7); border-radius: 4px; padding: 7px 11px; color: #fff; background: rgba(0, 0, 0, .2); text-decoration: none; }
      @media (max-width: 720px) { body { width: 100%; padding: 20px 12px; } }
      @media print { :root, body { background: #fff; } body { width: auto; padding: 0; } main { border: 0; box-shadow: none; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(document.title)}</h1>
        <p class="exported-at">Exported <time datetime="${exportedAt.toISOString()}">${escapeHtml(timestamp)}</time></p>
      </header>
      <div class="table-wrap">
        <table>
          <thead><tr>${document.columns.map((column) => `<th${createColumnStyle(column)}>${escapeHtml(column.title)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </main>
    ${imageLightboxes}
    <script id="${PAYLOAD_ID}" type="application/json">${canonicalPayload}</script>
  </body>
</html>`
}

function createColumnStyle(column: ColumnDef): string {
  const styles = [`text-align: ${getColumnAlign(column)}`]

  if (column.width && Number.isFinite(column.width) && column.width > 0) {
    styles.push(`width: ${column.width}px`)
  }

  if (column.wrap) {
    styles.push('white-space: pre-wrap')
  }

  return ` style="${styles.join('; ')}"`
}

function createRowStyle(height: number | undefined): string {
  if (!height || !Number.isFinite(height) || height <= 0) {
    return ''
  }

  return ` style="height: ${height}px"`
}

function renderRow(row: RowData, columns: ColumnDef[], rowIndex: number): string {
  return `<tr${createRowStyle(row.height)}>${columns.map((column, columnIndex) => `<td${createColumnStyle(column)}>${renderCell(column, row.cells[column.id] ?? '', imageLightboxId(rowIndex, columnIndex))}</td>`).join('')}</tr>`
}

function renderCell(column: ColumnDef, value: CellValue, imageId: string): string {
  if (column.type === 'image' && isImageValue(value)) {
    const fit = value.fit ?? 'cover'
    return `<a class="image-link" href="#${imageId}" aria-label="View ${escapeHtml(value.name)} at full size"><img class="fit-${fit}" src="${escapeHtml(value.dataUrl)}" alt="${escapeHtml(value.name)}"></a>`
  }

  const text = stringifyCellValue(value)
  if (!text) {
    return '<span class="empty-cell">—</span>'
  }

  if (column.type === 'link' && isSafeHttpUrl(text)) {
    return `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
  }

  return escapeHtml(text)
}

function renderImageLightboxes(document: SheetDocument): string {
  return document.rows
    .map((row, rowIndex) =>
      document.columns
        .map((column, columnIndex) => {
          const value = row.cells[column.id] ?? ''
          if (column.type !== 'image' || !isImageValue(value)) {
            return ''
          }

          const imageId = imageLightboxId(rowIndex, columnIndex)
          const name = escapeHtml(value.name)
          return `<aside class="image-lightbox" id="${imageId}" aria-label="${name}"><figure><img src="${escapeHtml(value.dataUrl)}" alt="${name}"><figcaption>${name}</figcaption><a class="image-lightbox-close" href="#" aria-label="Close full-size image">Close</a></figure></aside>`
        })
        .join(''),
    )
    .join('')
}

function imageLightboxId(rowIndex: number, columnIndex: number): string {
  return `rakuseru-image-${rowIndex + 1}-${columnIndex + 1}`
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return character
    }
  })
}
