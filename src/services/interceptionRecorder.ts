import { chromeProvider } from './chromeProvider'

let folderName: string | null = null
let fileCounter = 0

export const startRecording = (folder: string): void => {
  folderName = folder
  fileCounter = 0
}

export const stopRecording = (): void => {
  folderName = null
  fileCounter = 0
}

export const getFolderName = (): string | null => folderName

const sanitizeFilename = (name: string): string =>
  name.replaceAll(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)

export const writeInterception = (
  operationName: string,
  content: string
): void => {
  if (!folderName) return

  try {
    const chrome = chromeProvider()
    fileCounter++
    const ts = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, '-')
      .replaceAll('T', '_')
      .replaceAll('Z', '')
    const safeName = sanitizeFilename(operationName)
    const filename = `${folderName}/${String(fileCounter).padStart(4, '0')}_${safeName}_${ts}.json`

    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    chrome.downloads.download(
      {
        url,
        filename,
        conflictAction: 'uniquify',
        saveAs: false,
      },
      () => {
        URL.revokeObjectURL(url)
      }
    )
  } catch (e) {
    console.error('[InterceptionRecorder] Failed to write file:', e)
  }
}
