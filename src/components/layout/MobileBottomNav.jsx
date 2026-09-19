import { useLocation, useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'

const items = [
  { label: 'Home', icon: 'fa-home', to: '/' },
  { label: 'Requests', icon: 'fa-file-contract', to: '/requests' },
  { label: 'Expenses', icon: 'fa-wallet', to: '/it-expenses', match: /-(?:expenses)$/ },
]

export default function MobileBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const setSidebar = useUIStore((state) => state.setSidebar)

  const isActive = (item) => item.to === '/' ? location.pathname === '/' : item.match ? item.match.test(location.pathname) : location.pathname === item.to

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Mobile navigation">
      {items.map((item) => (
        <button key={item.label} type="button" onClick={() => navigate(item.to)} className={isActive(item) ? 'is-active' : ''}>
          <i className={`fas ${item.icon}`} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
      <button type="button" onClick={() => setSidebar(true)}>
        <i className="fas fa-bars" aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  )
}
