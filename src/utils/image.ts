import type { ImageCellValue } from '../model/document'

export function readImageFile(file: File): Promise<ImageCellValue> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Image reader did not return a data URL.'))
        return
      }

      resolve({
        kind: 'image',
        name: file.name,
        mime: file.type,
        dataUrl: reader.result,
      })
    })

    reader.addEventListener('error', () => reject(reader.error ?? new Error('Failed to read image file.')))
    reader.readAsDataURL(file)
  })
}
