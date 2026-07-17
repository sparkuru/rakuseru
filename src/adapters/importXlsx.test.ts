import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { buildXlsxDocument, createXlsxColumnMappings, parseXlsxWorkbook, type XlsxColumnMapping } from './importXlsx'

describe('XLSX import', () => {
  it('uses the first non-empty worksheet and removes blank rows and columns', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Empty')
    const worksheet = workbook.addWorksheet('Purchases')
    worksheet.addRow([])
    worksheet.addRow(['Item', '', 'Count'])
    worksheet.addRow(['Paper', '', 3])
    worksheet.addRow([])
    worksheet.addRow(['Pens', '', 4])

    const parsed = await parseWorkbook(workbook)
    const sheet = parsed.sheets.find((candidate) => candidate.name === 'Purchases')!

    expect(parsed.defaultSheetName).toBe('Purchases')
    expect(sheet.columns.map((column) => [column.sourceColumn, column.sourceTitle])).toEqual([[1, 'Item'], [3, 'Count']])
    expect(sheet.rowCount).toBe(2)
    expect(sheet.columns[0].cells.map((cell) => cell.text)).toEqual(['Paper', 'Pens'])
  })

  it('imports formulas as text, dates as display text, and warns about merges and images', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data')
    worksheet.addRow(['Formula', 'Date', 'Merged'])
    worksheet.getCell('A2').value = { formula: '1+1', result: 2, date1904: false }
    worksheet.getCell('B2').value = new Date(2026, 6, 17)
    worksheet.getCell('B2').numFmt = 'yyyy-mm-dd'
    worksheet.getCell('C2').value = 'Merged value'
    worksheet.mergeCells('C2:D2')
    const imageId = workbook.addImage({
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9ZQAAAABJRU5ErkJggg==',
      extension: 'png',
    })
    worksheet.addImage(imageId, 'A4:A4')

    const parsed = await parseWorkbook(workbook)
    const sheet = parsed.sheets[0]

    expect(sheet.columns[0].cells[0].text).toBe('=1+1')
    expect(sheet.columns[1].cells[0]).toMatchObject({ text: '2026-07-17', isDate: true })
    expect(sheet.columns.find((column) => column.sourceColumn === 4)).toBeUndefined()
    expect(sheet.warnings.map((warning) => warning.id)).toEqual(expect.arrayContaining(['images', 'merges']))
  })

  it('builds mapped documents with inferred select options', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data')
    worksheet.addRows([
      ['Name', 'Price', 'Status', 'Tags'],
      ['Paper', '$12.50', 'Open', 'office, urgent'],
      ['Pens', '5', 'Closed', 'office'],
    ])

    const sheet = (await parseWorkbook(workbook)).sheets[0]
    const mappings: XlsxColumnMapping[] = createXlsxColumnMappings(sheet).map((mapping) => ({
      ...mapping,
      type: mapping.sourceColumn === 2 ? 'money' : mapping.sourceColumn === 3 ? 'singleSelect' : mapping.sourceColumn === 4 ? 'multiSelect' : 'text',
    }))
    const result = buildXlsxDocument(sheet, mappings, 'Imported purchases')

    expect(result.issues).toEqual([])
    expect(result.document).toMatchObject({
      title: 'Imported purchases',
      columns: [
        { title: 'Name', type: 'text' },
        { title: 'Price', type: 'money' },
        { title: 'Status', type: 'singleSelect', options: ['Open', 'Closed'] },
        { title: 'Tags', type: 'multiSelect', options: ['office', 'urgent'] },
      ],
    })
    expect(result.document!.rows[0].cells[result.document!.columns[1].id]).toBe(12.5)
    expect(result.document!.rows[0].cells[result.document!.columns[3].id]).toEqual(['office', 'urgent'])
  })

  it('reports blocking mapping problems without creating a document', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data')
    worksheet.addRows([
      ['Name', 'Date', 'Link'],
      ['Paper', new Date(2026, 6, 17), 'not a URL'],
    ])
    worksheet.getCell('B2').numFmt = 'yyyy-mm-dd'

    const sheet = (await parseWorkbook(workbook)).sheets[0]
    const mappings: XlsxColumnMapping[] = createXlsxColumnMappings(sheet).map((mapping) => ({
      ...mapping,
      title: mapping.sourceColumn === 2 ? 'Name' : mapping.title,
      type: mapping.sourceColumn === 2 ? 'number' : mapping.sourceColumn === 3 ? 'link' : 'text',
    }))
    const result = buildXlsxDocument(sheet, mappings)

    expect(result.document).toBeUndefined()
    expect(result.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      '列标题不能重复。',
      '数字列包含无法转换的值。',
      '链接列只接受 http 或 https 地址。',
    ]))
  })
})

async function parseWorkbook(workbook: ExcelJS.Workbook) {
  const content = await workbook.xlsx.writeBuffer()
  return parseXlsxWorkbook(content as ArrayBuffer)
}
