import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, FolderKanban, Users, Briefcase, FileText, BarChart3, Settings, LogOut, Menu, X, Globe, IndianRupee, Handshake, Bell, FileSearch, Gift, ClipboardList, Layers, Flag, Mail, CalendarClock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@lib/utils';
import useAuthStore from '@store/authStore';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/app/admin' },
  { label: 'Catalog', icon: Package, path: '/app/admin/catalog' },
  { label: 'Orders', icon: ShoppingBag, path: '/app/admin/orders' },
  { label: 'Projects', icon: FolderKanban, path: '/app/admin/projects' },
  { label: 'Users', icon: Users, path: '/app/admin/users' },
  { label: 'Hiring', icon: Briefcase, path: '/app/admin/hiring' },
  { label: 'Engagements', icon: Handshake, path: '/app/admin/engagements' },
  { label: 'Finance', icon: IndianRupee, path: '/app/admin/finance' },
  { label: 'Content', icon: FileText, path: '/app/admin/content' },
  { label: 'RFPs', icon: FileSearch, path: '/app/admin/rfps' },
  { label: 'Referrals', icon: Gift, path: '/app/admin/referrals' },
  { label: 'Reports', icon: ClipboardList, path: '/app/admin/reports' },
  { label: 'Project Wall', icon: Layers, path: '/app/admin/project-wall' },
  { label: 'Notifications', icon: Bell, path: '/app/admin/notifications' },
  { label: 'Analytics', icon: BarChart3, path: '/app/admin/analytics' },
  { label: 'Feature Flags', icon: Flag, path: '/app/admin/flags' },
  { label: 'Pricing', icon: IndianRupee, path: '/app/admin/pricing' },
  { label: 'Templates', icon: Mail, path: '/app/admin/templates' },
  { label: 'Compliance', icon: CalendarClock, path: '/app/admin/compliance' },
  { label: 'Screening', icon: ShieldCheck, path: '/app/admin/screening' },
  { label: 'Settings', icon: Settings, path: '/app/admin/settings' },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-warm-50 flex">
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-64 bg-warm-900 text-warm-300 flex flex-col transition-transform lg:translate-x-0 lg:static', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-warm-800">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-fox-500 rounded-lg flex items-center justify-center shadow-sm shadow-fox-900/20">
              <img src="/logo.png" alt="StackFox" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-semibold text-white">stack<span className="text-fox-500">fox</span></span>
          </NavLink>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 hover:bg-warm-800 rounded text-warm-400"><X size={16} /></button>
        </div>

        <div className="px-3 py-2 mx-3 mt-3 bg-warm-800 rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-fox-400 font-semibold">Admin panel</span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/app/admin'} onClick={() => setOpen(false)}
              className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors', isActive ? 'bg-fox-500/15 text-fox-400' : 'text-warm-400 hover:bg-warm-800 hover:text-warm-200')}>
              <item.icon size={18} />{item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-warm-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-fox-500 text-white flex items-center justify-center text-sm font-medium">{user?.name?.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-warm-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-warm-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2 px-3">
            <NavLink to="/" className="flex items-center gap-1 text-xs text-warm-500 hover:text-warm-300"><Globe size={12} /> Site</NavLink>
            <button onClick={logout} className="flex items-center gap-1 text-xs text-danger-500 hover:text-danger-400 ml-auto"><LogOut size={12} /> Logout</button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-warm-200 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-20">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 hover:bg-warm-100 rounded-lg"><Menu size={20} /></button>
          <h1 className="text-lg font-semibold text-warm-900">Admin</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
