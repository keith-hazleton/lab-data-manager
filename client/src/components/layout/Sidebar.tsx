import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Experiments', icon: '🧪' },
  { to: '/samples', label: 'All Samples', icon: '🧫' },
  { to: '/storage', label: 'Sample Storage', icon: '🧊' },
  { to: '/plots', label: 'Plots', icon: '📊' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
