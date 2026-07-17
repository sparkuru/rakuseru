import { isImageValue, stringifyCellValue } from '../model/cell'
import { getColumnAlign } from '../model/column'
import { getCellBackgroundColor, toExcelFillColor } from '../model/color'
import type { SheetDocument } from '../model/document'

export async function exportXlsxBlob(document: SheetDocument): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Rakuseru')

  worksheet.addRow(document.columns.map((column) => column.title))
  for (const row of document.rows) {
    worksheet.addRow(document.columns.map((column) => stringifyCellValue(row.cells[column.id] ?? '')))
  }

  worksheet.columns.forEach((column, index) => {
    column.width = Math.max(12, Math.round((document.columns[index]?.width ?? 160) / 8))
  })

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: 'middle' }
  document.columns.forEach((column, index) => {
    if (column.backgroundColor) {
      headerRow.getCell(index + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toExcelFillColor(column.backgroundColor) } }
    }
  })

  for (let rowIndex = 0; rowIndex < document.rows.length; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex + 2)
    const rowData = document.rows[rowIndex]
    document.columns.forEach((column, index) => {
      const value = rowData.cells[column.id] ?? ''
      row.getCell(index + 1).alignment = {
        horizontal: getColumnAlign(column),
        vertical: 'middle',
        wrapText: Boolean(column.wrap),
      }
      const backgroundColor = getCellBackgroundColor(rowData, column)
      if (backgroundColor) {
        row.getCell(index + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toExcelFillColor(backgroundColor) } }
      }

      if (isImageValue(value)) {
        const extension = excelImageExtension(value.mime)
        if (extension) {
          const imageId = workbook.addImage({ base64: value.dataUrl, extension })
          worksheet.addImage(imageId, {
            tl: { col: index, row: rowIndex + 1 },
            ext: { width: Math.min(column.width ?? 180, 280), height: Math.min(rowData.height ?? 160, 220) },
          })
          row.height = Math.max(row.height ?? 0, Math.min(rowData.height ?? 160, 220) * 0.75)
        }
      }
    })
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()

  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function excelImageExtension(mime: string): 'png' | 'jpeg' | 'gif' | undefined {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpeg'
    case 'image/gif':
      return 'gif'
    default:
      return undefined
  }
}
