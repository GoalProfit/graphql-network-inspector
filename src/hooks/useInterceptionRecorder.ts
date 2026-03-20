import { useCallback, useEffect, useRef, useState } from 'react'
import { ICompleteNetworkRequest } from '../helpers/networkHelpers'
import {
  startRecording as startService,
  stopRecording as stopService,
  writeInterception,
} from '../services/interceptionRecorder'

export interface UseInterceptionRecorderResult {
  isRecording: boolean
  folderName: string | null
  recordedCount: number
  startRecording: () => void
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
  const [folderName, setFolderName] = useState<string | null>(null)
  const [recordedCount, setRecordedCount] = useState(0)
  const writtenIdsRef = useRef<Set<string>>(new Set())

  const startRecording = useCallback(() => {
    const name = globalThis.prompt(
      'Enter folder name for captured requests.\n' +
        'Files will be saved to your Downloads directory.',
      'graphql-intercepts'
    )
    if (!name) return

    startService(name)
    setFolderName(name)
    writtenIdsRef.current = new Set(networkRequests.map((r) => r.id))
    setRecordedCount(0)
    setIsRecording(true)
  }, [networkRequests])

  const stopRecording = useCallback(() => {
    stopService()
    setIsRecording(false)
    setFolderName(null)
    writtenIdsRef.current = new Set()
  }, [])

  useEffect(() => {
    if (!isRecording) return

    const newCompleteRequests = networkRequests.filter(
      (req) => req.response && !writtenIdsRef.current.has(req.id)
    )

    for (const req of newCompleteRequests) {
      writtenIdsRef.current.add(req.id)
      const operationName =
        req.request.primaryOperation.operationName || 'unknown'
      const payload = buildInterceptionPayload(req)

      writeInterception(operationName, JSON.stringify(payload, null, 2))
      setRecordedCount((c) => c + 1)
    }
  }, [networkRequests, isRecording])

  return { isRecording, folderName, recordedCount, startRecording, stopRecording }
}
