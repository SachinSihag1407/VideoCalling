import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Heart, User, ChevronDown, Settings, Bell } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [notificationsCount, setNotificationsCount] = React.useState(2);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-300">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                CARE
              </span>
            </Link>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button 
                className="relative p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                aria-label="Clear notifications"
                onClick={() => setNotificationsCount(0)}
              >
                <Bell className="w-5 h-5" />
                {notificationsCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 p-1.5 pr-3 bg-slate-100 hover:bg-slate-200 rounded-full transition"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    user.role === 'doctor' 
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                  }`}>
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-800">{user.full_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-800">{user.full_name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    {/* TODO: Implement settings functionality */}
                    <button 
                      className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 flex items-center space-x-2 cursor-not-allowed"
                      aria-disabled="true"
                      title="Settings not implemented yet"
                      disabled
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    <button
                      onClick={logout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {children}

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;
