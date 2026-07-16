import { isImageValue } from '../model/cell'
import type { SheetDocument } from '../model/document'
import type JSZip from 'jszip'
import { importJson } from './importJson'

const ARCHIVE_KIND = 'rakuseru-json-zip'
const ARCHIVE_VERSION = 1
const ARCHIVE_IMAGE_PATH = /^img\/image-\d+\.[a-z0-9]+$/i

type ArchiveManifest = {
  kind: typeof ARCHIVE_KIND
  version: typeof ARCHIVE_VERSION
  document: unknown
}

export async function exportJsonZipBlob(document: SheetDocument): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const imagePaths = new Map<string, string>()
  const images: Array<{ path: string; base64: string }> = []
  const archiveDocument: SheetDocument = {
    ...document,
    rows: document.rows.map((row) => ({
      ...row,
      cells: Object.fromEntries(
        document.columns.map((column) => {
          const value = row.cells[column.id] ?? ''
          if (!isImageValue(value)) {
            return [column.id, value]
          }

          let imagePath = imagePaths.get(value.dataUrl)
          if (!imagePath) {
            const image = readEmbeddedImage(value.dataUrl)
            imagePath = `img/image-${imagePaths.size + 1}.${image.extension}`
            imagePaths.set(value.dataUrl, imagePath)
            images.push({ path: imagePath, base64: image.base64 })
          }

          return [column.id, { ...value, dataUrl: imagePath }]
        }),
      ),
    })),
  }
  const manifest: ArchiveManifest = { kind: ARCHIVE_KIND, version: ARCHIVE_VERSION, document: archiveDocument }

  zip.file(`${archiveStem(document.title)}.json`, JSON.stringify(manifest, null, 2))
  for (const image of images) {
    zip.file(image.path, image.base64, { base64: true })
  }

  return zip.generateAsync({ type: 'blob' })
}

export async function importJsonZip(content: ArrayBuffer): Promise<SheetDocument> {
  const { default: JSZip } = await import('jszip')
  let zip: JSZip

  try {
    zip = await JSZip.loadAsync(content)
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid Rakuseru JSON ZIP: ${error.message}` : 'Invalid Rakuseru JSON ZIP.', { cause: error })
  }

  const manifestFiles = Object.values(zip.files).filter((file) => !file.dir && file.name.endsWith('.json'))
  if (manifestFiles.length !== 1) {
    throw new Error('Rakuseru JSON ZIP must contain exactly one JSON manifest.')
  }

  let manifest: unknown
  try {
    manifest = JSON.parse(await manifestFiles[0].async('string'))
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid JSON manifest: ${error.message}` : 'Invalid JSON manifest.', { cause: error })
  }

  if (!isArchiveManifest(manifest)) {
    throw new Error('This ZIP file is not a Rakuseru JSON image archive.')
  }

  const restoredDocument = await restoreArchiveImages(manifest.document, zip)
  return importJson(JSON.stringify(restoredDocument))
}

function isArchiveManifest(input: unknown): input is ArchiveManifest {
  if (!isRecord(input)) {
    return false
  }

  return input.kind === ARCHIVE_KIND && input.version === ARCHIVE_VERSION && isRecord(input.document)
}

async function restoreArchiveImages(document: unknown, zip: JSZip): Promise<unknown> {
  if (!isRecord(document) || !Array.isArray(document.rows)) {
    return document
  }

  return {
    ...document,
    rows: await Promise.all(
      document.rows.map(async (row) => {
        if (!isRecord(row) || !isRecord(row.cells)) {
          return row
        }

        return {
          ...row,
          cells: Object.fromEntries(
            await Promise.all(
              Object.entries(row.cells).map(async ([columnId, value]) => {
                if (!isImageValue(value)) {
                  return [columnId, value]
                }

                if (!ARCHIVE_IMAGE_PATH.test(value.dataUrl)) {
                  throw new Error(`Archive image reference is invalid: ${value.dataUrl}`)
                }

                const imageFile = zip.file(value.dataUrl)
                if (!imageFile) {
                  throw new Error(`Archive image is missing: ${value.dataUrl}`)
                }

                const base64 = await imageFile.async('base64')
                return [columnId, { ...value, dataUrl: `data:${value.mime};base64,${base64}` }]
              }),
            ),
          ),
        }
      }),
    ),
  }
}

function readEmbeddedImage(dataUrl: string): { base64: string; extension: string } {
  const match = /^data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(dataUrl)
  if (!match) {
    throw new Error('Only base64-encoded image data can be exported in a Rakuseru JSON ZIP.')
  }

  return { extension: match[1].replace(/[^a-z0-9]+/gi, '-'), base64: match[2] }
}

function archiveStem(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'rakuseru-sheet'
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
