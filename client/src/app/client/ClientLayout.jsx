import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, FileText, Receipt, Files, MessageCircle, User, LifeBuoy, ShoppingCart, LogOut, Menu, X, Handshake, ScrollText, Clock, Bell, Milestone, Gift, Layers, MessageSquare, Activity, GitPullRequest, BarChart3, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@lib/utils';
import useAuthStore from '@store/authStore';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/app/client' },
  { label: 'Projects', icon: FolderKanban, path: '/app/client/projects' },
  { label: 'Quotes', icon: FileText, path: '/app/client/quotes' },
  { label: 'Invoices', icon: Receipt, path: '/app/client/invoices' },
  { label: 'Files', icon: Files, path: '/app/client/files' },
  { label: 'Messages', icon: MessageCircle, path: '/app/client/messages' },
  { label: 'Engagements', icon: Handshake, path: '/app/client/engagements' },
  { label: 'Contracts', icon: ScrollText, path: '/app/client/contracts' },
  { label: 'Timesheets', icon: Clock, path: '/app/client/timesheets' },
  { label: 'Milestones', icon: Milestone, path: '/app/client/milestones' },
  { label: 'Workspace', icon: Layers, path: '/app/client/workspace' },
  { label: 'Activity', icon: Activity, path: '/app/client/activity' },
  { label: 'Changes', icon: GitPullRequest, path: '/app/client/changes' },
  { label: 'Reports', icon: BarChart3, path: '/app/client/reports' },
  { label: 'Feedback', icon: MessageSquare, path: '/app/client/feedback' },
  { label: 'Referrals', icon: Gift, path: '/app/client/referrals' },
  { label: 'Handover', icon: PackageCheck, path: '/app/client/handover' },
  { label: 'Cart', icon: ShoppingCart, path: '/app/client/cart' },
  { label: 'Support', icon: LifeBuoy, path: '/app/client/support' },
  { label: 'Notifications', icon: Bell, path: '/app/client/notifications' },
  { label: 'Profile', icon: User, path: '/app/client/profile' },
];

export default function ClientLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-warm-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-warm-200 flex flex-col transition-transform lg:translate-x-0 lg:static',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-warm-100">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-fox-500 rounded-lg flex items-center justify-center shadow-sm shadow-fox-200">
              <img src="/logo.png" alt="StackFox" className="w-5 h-5 object-contain" />
            </div>
            <span className="flex flex-col font-semibold leading-none">
              <span><span className="text-warm-900">stack</span><span className="text-fox-500">fox</span></span>
              <span className="text-[8px] text-warm-400 font-bold tracking-tight mt-0.5">by ARTWALL LABS</span>
            </span>
          </NavLink>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-warm-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/app/client'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive ? 'bg-fox-50 text-fox-600' : 'text-warm-600 hover:bg-warm-50 hover:text-warm-900'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-warm-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-fox-100 text-fox-700 flex items-center justify-center text-sm font-medium">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-warm-900 truncate">{user?.name}</p>
              <p className="text-[11px] text-warm-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-danger-500 hover:bg-danger-50 w-full transition-colors">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-warm-200 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-warm-100 rounded-lg">
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold text-warm-900">Client Dashboard</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
