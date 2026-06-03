import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/send',      icon: '📤', label: 'Send SMS' },
  { to: '/contacts',  icon: '👥', label: 'Contacts' },
  { to: '/categories',icon: '🏷️', label: 'Categories' },
  { to: '/templates', icon: '📝', label: 'Templates' },
  { to: '/history',   icon: '📋', label: 'SMS History' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">💬</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">BulkSMS</span>
          <span className="sidebar-logo-sub">Corporate Platform</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-nav-label">Main Menu</span>
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              'sidebar-link' + (isActive ? ' active' : '')
            }
          >
            <span className="sidebar-link-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontWeight: 600, color: 'var(--gray-400)', marginBottom: 2 }}>
          BulkSMS v1.0
        </div>
        <div>Corporate Edition</div>
      </div>
    </aside>
  );
}
