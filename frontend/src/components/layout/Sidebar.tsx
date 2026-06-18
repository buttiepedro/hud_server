import { NavLink } from 'react-router-dom'

const nav = [
  { to: '/', label: '▣ Dashboard' },
  { to: '/containers', label: '⬡ Containers' },
  { to: '/connections', label: '⌁ Connections' },
]

export function Sidebar() {
  return (
    <nav className="w-44 flex-shrink-0 border-r border-hud-border bg-hud-card flex flex-col py-6 gap-1">
      {nav.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `px-5 py-2.5 text-sm tracking-wide transition-colors ${
              isActive
                ? 'text-hud-blue border-r-2 border-hud-blue bg-hud-blue/5'
                : 'text-hud-muted hover:text-hud-text'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
