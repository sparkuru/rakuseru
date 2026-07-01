import { validateSheetDocument } from '../model/validation'
import type { SheetDocument } from '../model/document'

export function importJson(content: string): SheetDocument {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.', { cause: error })
  }

  const result = validateSheetDocument(parsed)
  if (!result.ok) {
    throw new Error(result.errors.join('\n'))
  }

  return result.value
}
