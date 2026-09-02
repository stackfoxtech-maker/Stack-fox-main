import {
  LayoutDashboard, Users, GitBranch, Mic, MessageSquare, Phone, Calendar,
  FileText, BookOpen, TrendingUp,
} from 'lucide-react';
import DashboardShell from '@app/DashboardShell';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/team/sales' },
  { label: 'Leads', icon: Users, path: '/app/team/sales/leads' },
  { label: 'Pipeline', icon: GitBranch, path: '/app/team/sales/pipeline' },
  { label: 'Pitch Studio', icon: Mic, path: '/app/team/sales/pitch-studio' },
  { label: 'Objections', icon: MessageSquare, path: '/app/team/sales/objections' },
  { label: 'Sales Call', icon: Phone, path: '/app/team/sales/sales-call' },
  { label: 'Follow-ups', icon: Calendar, path: '/app/team/sales/follow-ups' },
  { label: 'Proposals', icon: FileText, path: '/app/team/sales/proposals' },
  { label: 'Knowledge Center', icon: BookOpen, path: '/app/team/sales/knowledge-center' },
  { label: 'Pitch History', icon: TrendingUp, path: '/app/team/sales/pitch-history' },
];

const tabItems = [navItems[0], navItems[1], navItems[2], navItems[6]]; // Dashboard · Leads · Pipeline · Follow-ups

export default function SalesLayout() {
  return <DashboardShell title="Sales" navItems={navItems} tabItems={tabItems} />;
}
