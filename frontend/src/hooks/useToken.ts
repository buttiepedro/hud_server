import { useState, useCallback } from 'react'

const LS_KEY = 'hud_token'

function getStoredToken(): string {
  return import.meta.env.VITE_HUD_TOKEN || localStorage.getItem(LS_KEY) || ''
}

export function useToken() {
  const [token, setTokenState] = useState<string>(getStoredToken)

  const saveToken = useCallback((t: string) => {
    localStorage.setItem(LS_KEY, t)
    setTokenState(t)
  }, [])

  const clearToken = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    setTokenState('')
  }, [])

  return { token, saveToken, clearToken }
}
