interface DirectoryHandle {
  name: string
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<any>
}

let directoryHandle: DirectoryHandle | null = null
let fileCounter = 0

export const selectDirectory = async (): Promise<DirectoryHandle | null> => {
  try {
    directoryHandle = await (globalThis as any).showDirectoryPicker({
      mode: 'readwrite',
    })
    fileCounter = 0
    return directoryHandle
  } catch {
    return null
  }
}

export const getDirectoryHandle = (): DirectoryHandle | null => directoryHandle

export const clearDirectoryHandle = (): void => {
  directoryHandle = null
  fileCounter = 0
}

const sanitizeFilename = (name: string): string =>
  name.replaceAll(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)

export const writeInterception = async (
  dirHandle: DirectoryHandle,
  operationName: string,
  content: string
): Promise<void> => {
  try {
    fileCounter++
    const ts = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, '-')
      .replaceAll('T', '_')
      .replaceAll('Z', '')
    const safeName = sanitizeFilename(operationName)
    const filename = `${String(fileCounter).padStart(4, '0')}_${safeName}_${ts}.json`
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  } catch (e) {
    console.error('[InterceptionRecorder] Failed to write file:', e)
  }
}
