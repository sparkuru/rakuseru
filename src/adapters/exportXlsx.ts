import { stringifyCellValue } from '../model/cell'
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

  const arrayBuffer = await workbook.xlsx.writeBuffer()

  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
