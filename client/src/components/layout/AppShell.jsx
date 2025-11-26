import { UserButton } from '@clerk/clerk-react'
import { NavLink } from 'react-router-dom'

const AppShell = ({ activeTab = 'detailed', children, showTabs = true }) => {
  const sidebarItems = [
    { label: 'Detailed View', to: '/' },
    { label: 'Upload', to: '/upload' },
    { label: 'Creatives', to: '/creatives' },
    { label: 'Actions', to: '/actions' },
    { label: 'Settings', to: '/settings' },
  ]

  return (
    <div className="detailed-page">
      <aside className="detailed-sidebar">
        <div className="sidebar-profile">
          <div className="profile-avatar">
            <UserButton />
          </div>
          <div className="profile-text">Profil</div>
        </div>
        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <img src="/Logo-White.png" alt="InsightAdsAI logo" className="sidebar-logo-img" />
        </div>
      </aside>

      <main className="detailed-main">
        {showTabs && (
          <div className="top-tabs">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `tab-pill ${isActive || activeTab === 'detailed' ? 'active' : ''}`
              }
            >
              Detailed View
            </NavLink>
            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `tab-pill ${isActive || activeTab === 'upload' ? 'active' : ''}`
              }
            >
              Upload
            </NavLink>
          </div>
        )}

        <div className="main-container">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
