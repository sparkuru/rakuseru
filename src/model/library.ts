import { createId } from '../utils/ids'
import { createSheetDocument } from './document'
import type { SheetDocument } from './document'
import { validateSheetDocument } from './validation'

export type LibraryDocumentRecord = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  document: SheetDocument
}

export type LibraryDocumentSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type DocumentLibrarySnapshot = {
  version: 1
  activeDocumentId: string
  summaries: LibraryDocumentSummary[]
  records: LibraryDocumentRecord[]
}

export type StoredLibraryIndex = {
  version: 1
  activeDocumentId: string
  order: string[]
}

export function createLibraryDocumentRecord(document = createSheetDocument(), now = new Date().toISOString()): LibraryDocumentRecord {
  return {
    id: createId('sheet'),
    title: document.title,
    createdAt: now,
    updatedAt: now,
    document: cloneSheetDocument(document),
  }
}

export function createDefaultLibrarySnapshot(now = new Date().toISOString()): DocumentLibrarySnapshot {
  const record = createLibraryDocumentRecord(createSheetDocument(), now)
  return createDocumentLibrarySnapshot([record], record.id)
}

export function createDocumentLibrarySnapshot(records: LibraryDocumentRecord[], activeDocumentId?: string): DocumentLibrarySnapshot {
  const usableRecords = records.length > 0 ? records : [createLibraryDocumentRecord()]
  const activeRecord = usableRecords.find((record) => record.id === activeDocumentId) ?? usableRecords[0]

  return {
    version: 1,
    activeDocumentId: activeRecord.id,
    summaries: usableRecords.map(createLibraryDocumentSummary),
    records: usableRecords,
  }
}

export function createLibraryDocumentSummary(record: LibraryDocumentRecord): LibraryDocumentSummary {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function createStoredLibraryIndex(snapshot: DocumentLibrarySnapshot): StoredLibraryIndex {
  return {
    version: 1,
    activeDocumentId: snapshot.activeDocumentId,
    order: snapshot.summaries.map((summary) => summary.id),
  }
}

export function duplicateLibraryDocumentRecord(record: LibraryDocumentRecord, now = new Date().toISOString()): LibraryDocumentRecord {
  const document = cloneSheetDocument(record.document)
  document.title = `${record.title} 副本`

  return {
    id: createId('sheet'),
    title: document.title,
    createdAt: now,
    updatedAt: now,
    document,
  }
}

export function updateLibraryDocumentRecord(record: LibraryDocumentRecord, document: SheetDocument, now = new Date().toISOString()): LibraryDocumentRecord {
  return {
    ...record,
    title: document.title,
    updatedAt: now,
    document: cloneSheetDocument(document),
  }
}

export function validateLibraryDocumentRecord(input: unknown): LibraryDocumentRecord | undefined {
  if (!isRecord(input) || typeof input.id !== 'string' || input.id.trim() === '') {
    return undefined
  }

  const result = validateSheetDocument(input.document)
  if (!result.ok) {
    return undefined
  }

  const now = new Date().toISOString()
  const title = typeof input.title === 'string' && input.title.trim() ? input.title : result.value.title
  const createdAt = typeof input.createdAt === 'string' && input.createdAt.trim() ? input.createdAt : now
  const updatedAt = typeof input.updatedAt === 'string' && input.updatedAt.trim() ? input.updatedAt : createdAt

  return {
    id: input.id,
    title,
    createdAt,
    updatedAt,
    document: { ...result.value, title },
  }
}

export function validateStoredLibraryIndex(input: unknown): StoredLibraryIndex | undefined {
  if (!isRecord(input) || input.version !== 1 || typeof input.activeDocumentId !== 'string' || !Array.isArray(input.order)) {
    return undefined
  }

  const order = input.order.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  if (order.length === 0) {
    return undefined
  }

  return {
    version: 1,
    activeDocumentId: input.activeDocumentId,
    order,
  }
}

export function cloneSheetDocument(document: SheetDocument): SheetDocument {
  return structuredClone(document)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
