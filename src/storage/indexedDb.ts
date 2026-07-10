import { openDB } from 'idb'

import type { SheetDocument } from '../model/document'
import {
  createDefaultLibrarySnapshot,
  createDocumentLibrarySnapshot,
  createLibraryDocumentRecord,
  createStoredLibraryIndex,
  type DocumentLibrarySnapshot,
  type LibraryDocumentRecord,
  validateLibraryDocumentRecord,
  validateStoredLibraryIndex,
} from '../model/library'
import { validateSheetDocument } from '../model/validation'

const DATABASE_NAME = 'rakuseru'
const STORE_NAME = 'documents'
const ACTIVE_DOCUMENT_KEY = 'active'
const LIBRARY_INDEX_KEY = 'library:index'
const LIBRARY_DOCUMENT_KEY_PREFIX = 'library:document:'

export async function loadActiveDocument(): Promise<SheetDocument | undefined> {
  const db = await openRakuseruDb()
  const stored = await db.get(STORE_NAME, ACTIVE_DOCUMENT_KEY)
  const result = validateSheetDocument(stored)

  return result.ok ? result.value : undefined
}

export async function saveActiveDocument(document: SheetDocument): Promise<void> {
  const db = await openRakuseruDb()
  await db.put(STORE_NAME, document, ACTIVE_DOCUMENT_KEY)
}

export async function loadDocumentLibrary(): Promise<DocumentLibrarySnapshot> {
  const db = await openRakuseruDb()
  const storedIndex = validateStoredLibraryIndex(await db.get(STORE_NAME, LIBRARY_INDEX_KEY))

  if (storedIndex) {
    const records = await loadRecordsById(storedIndex.order)
    if (records.length > 0) {
      const snapshot = createDocumentLibrarySnapshot(records, storedIndex.activeDocumentId)
      if (snapshot.activeDocumentId !== storedIndex.activeDocumentId || records.length !== storedIndex.order.length) {
        await saveDocumentLibrary(snapshot)
      }

      return snapshot
    }
  }

  const legacy = validateSheetDocument(await db.get(STORE_NAME, ACTIVE_DOCUMENT_KEY))
  const snapshot = legacy.ok ? createDocumentLibrarySnapshot([createLibraryDocumentRecord(legacy.value)]) : createDefaultLibrarySnapshot()
  await saveDocumentLibrary(snapshot)

  return snapshot
}

export async function saveActiveLibraryDocument(snapshot: DocumentLibrarySnapshot): Promise<void> {
  const db = await openRakuseruDb()
  const activeRecord = snapshot.records.find((record) => record.id === snapshot.activeDocumentId)

  await db.put(STORE_NAME, createStoredLibraryIndex(snapshot), LIBRARY_INDEX_KEY)
  if (activeRecord) {
    await db.put(STORE_NAME, activeRecord, createLibraryDocumentKey(activeRecord.id))
  }
}

export async function saveDocumentLibrary(snapshot: DocumentLibrarySnapshot): Promise<void> {
  const db = await openRakuseruDb()

  await db.put(STORE_NAME, createStoredLibraryIndex(snapshot), LIBRARY_INDEX_KEY)
  await Promise.all(snapshot.records.map((record) => db.put(STORE_NAME, record, createLibraryDocumentKey(record.id))))
}

function openRakuseruDb() {
  return openDB(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

async function loadRecordsById(ids: string[]): Promise<LibraryDocumentRecord[]> {
  const db = await openRakuseruDb()
  const records = await Promise.all(ids.map(async (id) => validateLibraryDocumentRecord(await db.get(STORE_NAME, createLibraryDocumentKey(id)))))

  return records.filter((record): record is LibraryDocumentRecord => Boolean(record))
}

function createLibraryDocumentKey(id: string): string {
  return `${LIBRARY_DOCUMENT_KEY_PREFIX}${id}`
}
