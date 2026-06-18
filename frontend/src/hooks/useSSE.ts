import { useEffect, useRef } from 'react'
import type { DashboardSnapshot } from '../types'
import { useSnapshotStore } from '../store/snapshotStore'

export function useSSE(token: string) {
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot)
  const setConnected = useSnapshotStore((s) => s.setConnected)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!token) return

    const url = `/api/stream?token=${encodeURIComponent(token)}`

    function connect() {
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (event) => {
        try {
          const data: DashboardSnapshot = JSON.parse(event.data)
          setSnapshot(data)
        } catch (e) {
          console.error('Failed to parse SSE data', e)
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Retry after 5 seconds
        setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      esRef.current?.close()
    }
  }, [token, setSnapshot, setConnected])
}
