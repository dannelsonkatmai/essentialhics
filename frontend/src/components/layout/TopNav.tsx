import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, User, LogOut, Monitor, Bell } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../api/auth.api';
import NotificationsPanel from '../notifications/NotificationsPanel';
import { useNotifications } from '../../hooks/useNotifications';

export default function TopNav() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    navigate('/login');
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  return (
    <>
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {/* Breadcrumb rendered by each page */}
        <span id="breadcrumb-portal" />
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications bell */}
        <button
          onClick={() => setShowNotifications(true)}
          className="relative p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full hover:bg-gray-50 px-2 py-1 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 max-w-[140px] truncate">
              {user?.displayName ?? `${user?.firstName} ${user?.lastName}`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" /> Profile & Security
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile?tab=sessions'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Monitor className="h-4 w-4" /> Active Sessions
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
  </>
  );
}
