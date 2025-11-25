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

        {children}
      </main>
    </div>
  )
}

export default AppShell
