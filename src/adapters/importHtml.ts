import { importJson } from './importJson'
import type { SheetDocument } from '../model/document'

const PAYLOAD_SELECTOR = 'script#rakuseru-document[type="application/json"]'

export function importHtml(content: string): SheetDocument {
  const parsed = new DOMParser().parseFromString(content, 'text/html')
  const payloads = parsed.querySelectorAll(PAYLOAD_SELECTOR)

  if (payloads.length === 0) {
    throw new Error('This HTML file does not contain a Rakuseru document payload.')
  }

  if (payloads.length > 1) {
    throw new Error('This HTML file contains multiple Rakuseru document payloads.')
  }

  return importJson(payloads[0].textContent ?? '')
}
