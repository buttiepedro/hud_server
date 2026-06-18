import { useState } from 'react'

interface Props {
  onSubmit: (token: string) => void
}

export function TokenGate({ onSubmit }: Props) {
  const [value, setValue] = useState('')

  return (
    <div className="flex items-center justify-center h-screen bg-hud-bg">
      <div className="hud-card flex flex-col gap-6 w-96">
        <div className="text-center">
          <p className="text-hud-blue text-xl font-semibold tracking-widest">◈ SERVER HUD</p>
          <p className="text-hud-muted text-xs mt-1">Enter your API token to continue</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()) }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            placeholder="API token"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="bg-hud-bg border border-hud-border rounded px-3 py-2 text-hud-text text-sm focus:outline-none focus:border-hud-blue font-mono placeholder:text-hud-muted"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="bg-hud-blue/10 border border-hud-blue/40 text-hud-blue rounded py-2 text-sm font-medium tracking-wide hover:bg-hud-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            CONNECT
          </button>
        </form>
      </div>
    </div>
  )
}
