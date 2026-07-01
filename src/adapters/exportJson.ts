import type { SheetDocument } from '../model/document'

export function exportJson(document: SheetDocument): string {
  return JSON.stringify(document, null, 2)
}
