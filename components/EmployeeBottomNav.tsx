import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Clock, User } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Główna', icon: Home, path: '/dashboard' },
  { label: 'Zadania', icon: ClipboardList, path: '/employee/tasks' },
  { label: 'Czas', icon: Clock, path: '/employee/attendance' },
  { label: 'Profil', icon: User, path: '/dashboard/profile' },
];

/**
 * PWA-style bottom navigation bar for employee mobile view.
 * Add pb-20 or pb-24 to the page container to leave space for this bar.
 */
export const EmployeeBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex">
        {NAV_ITEMS.map(item => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600 active:text-slate-600'
              }`}
            >
              <item.icon
                className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default EmployeeBottomNav;
