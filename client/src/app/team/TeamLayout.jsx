import {
  LayoutDashboard, CheckSquare, FolderKanban, User, Clock, Calendar, Star,
  BookOpen, Inbox, Kanban, Cpu, Bug, IndianRupee, Users, BarChart3, Sparkles,
} from 'lucide-react';
import DashboardShell from '@app/DashboardShell';

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

const tabItems = [navItems[0], navItems[1], navItems[2], navItems[3]]; // Dashboard · Tasks · Projects · Timesheets

export default function TeamLayout() {
  return <DashboardShell title="Team" navItems={navItems} tabItems={tabItems} />;
}
