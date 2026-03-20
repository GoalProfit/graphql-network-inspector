import { useCallback, useEffect, useRef, useState } from 'react'
import { ICompleteNetworkRequest } from '../helpers/networkHelpers'
import {
  selectDirectory,
  writeInterception,
  clearDirectoryHandle,
} from '../services/interceptionRecorder'

export interface UseInterceptionRecorderResult {
  isRecording: boolean
  directoryName: string | null
  recordedCount: number
  startRecording: () => Promise<void>
  stopRecording: () => void
}

const tryParseJSON = (str: string | undefined): unknown => {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

const buildInterceptionPayload = (req: ICompleteNetworkRequest) => ({
  timestamp: new Date().toISOString(),
  operationName: req.request.primaryOperation.operationName,
  operationType: req.request.primaryOperation.operation,
  url: req.url,
  method: req.method,
  status: req.status,
  request: req.request.body.map((b) => ({
    query: b.query,
    variables: b.variables,
    operationName: b.operationName,
  })),
  response: {
    status: req.status,
    headers: req.response?.headers,
    body: tryParseJSON(req.response?.body),
  },
})

export const useInterceptionRecorder = (
  networkRequests: ICompleteNetworkRequest[]
): UseInterceptionRecorderResult => {
  const [isRecording, setIsRecording] = useState(false)
  const [directoryName, setDirectoryName] = useState<string | null>(null)
  const [recordedCount, setRecordedCount] = useState(0)
  const dirHandleRef = useRef<any>(null)
  const writtenIdsRef = useRef<Set<string>>(new Set())

  const startRecording = useCallback(async () => {
    const handle = await selectDirectory()
    if (handle) {
      dirHandleRef.current = handle
      setDirectoryName(handle.name)
      writtenIdsRef.current = new Set(
        networkRequests.map((r) => r.id)
      )
      setRecordedCount(0)
      setIsRecording(true)
    }
  }, [networkRequests])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    dirHandleRef.current = null
    clearDirectoryHandle()
    setDirectoryName(null)
    writtenIdsRef.current = new Set()
  }, [])

  useEffect(() => {
    if (!isRecording || !dirHandleRef.current) return

    const dirHandle = dirHandleRef.current
    const newCompleteRequests = networkRequests.filter(
      (req) => req.response && !writtenIdsRef.current.has(req.id)
    )

    for (const req of newCompleteRequests) {
      writtenIdsRef.current.add(req.id)
      const operationName =
        req.request.primaryOperation.operationName || 'unknown'
      const payload = buildInterceptionPayload(req)

      writeInterception(dirHandle, operationName, JSON.stringify(payload, null, 2))
      setRecordedCount((c) => c + 1)
    }
  }, [networkRequests, isRecording])

  return { isRecording, directoryName, recordedCount, startRecording, stopRecording }
}
