import { openDB } from 'idb'

import type { SheetDocument } from '../model/document'
import { validateSheetDocument } from '../model/validation'

const DATABASE_NAME = 'rakuseru'
const STORE_NAME = 'documents'
const ACTIVE_DOCUMENT_KEY = 'active'

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

function openRakuseruDb() {
  return openDB(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}
