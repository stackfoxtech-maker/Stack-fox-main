import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, FolderKanban, User, LogOut, Menu, X, Clock, Calendar, Star, BookOpen, Inbox, Kanban, Cpu, Bug, IndianRupee, Users, BarChart3, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@lib/utils';
import useAuthStore from '@store/authStore';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/team' },
  { label: 'Tasks', icon: CheckSquare, path: '/app/team/tasks' },
  { label: 'Projects', icon: FolderKanban, path: '/app/team/projects' },
  { label: 'Timesheets', icon: Clock, path: '/app/team/timesheets' },
  { label: 'Calendar', icon: Calendar, path: '/app/team/calendar' },
  { label: 'Reviews', icon: Star, path: '/app/team/reviews' },
  { label: 'Knowledge', icon: BookOpen, path: '/app/team/knowledge' },
  { label: 'Queue', icon: Inbox, path: '/app/team/queue' },
  { label: 'Sprints', icon: Kanban, path: '/app/team/sprints' },
  { label: 'Resources', icon: Cpu, path: '/app/team/resources' },
  { label: 'Quality', icon: Bug, path: '/app/team/quality' },
  { label: 'Finance', icon: IndianRupee, path: '/app/team/finance' },
  { label: 'Clients', icon: Users, path: '/app/team/clients' },
  { label: 'Analytics', icon: BarChart3, path: '/app/team/analytics' },
  { label: 'SE Queue', icon: Sparkles, path: '/app/team/se-queue' },
  { label: 'Profile', icon: User, path: '/app/team/profile' },
];

export default function TeamLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-warm-50 flex">
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-warm-200 flex flex-col transition-transform lg:translate-x-0 lg:static', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-warm-100">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-fox-500 rounded-lg flex items-center justify-center shadow-sm shadow-fox-200">
              <img src="/logo.png" alt="StackFox" className="w-4 h-4 object-contain" />
            </div>
            <span className="font-semibold text-sm"><span className="text-warm-900">stack</span><span className="text-fox-500">fox</span></span>
          </NavLink>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1"><X size={16} /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/app/team'} onClick={() => setOpen(false)}
              className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors', isActive ? 'bg-fox-50 text-fox-600' : 'text-warm-600 hover:bg-warm-50')}>
              <item.icon size={18} />{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-warm-100">
          <p className="px-3 text-xs text-warm-500 truncate mb-2">{user?.name}</p>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-danger-500 hover:bg-danger-50 w-full"><LogOut size={16} />Log out</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-warm-200 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-20">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 hover:bg-warm-100 rounded-lg"><Menu size={20} /></button>
          <h1 className="text-lg font-semibold text-warm-900">Team Dashboard</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
