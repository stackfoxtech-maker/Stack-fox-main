import {
  LayoutDashboard, FolderKanban, FileText, Receipt, Files, MessageCircle, User,
  LifeBuoy, ShoppingCart, Bell, Handshake, ScrollText, Clock, Milestone, Gift,
  Layers, MessageSquare, Activity, GitPullRequest, BarChart3, PackageCheck,
} from 'lucide-react';
import DashboardShell from '@app/DashboardShell';

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

// Bottom tab bar — the four a client reaches for most; everything else is "More".
const tabItems = [
  navItems[0], // Overview
  navItems[1], // Projects
  navItems[3], // Invoices
  navItems[5], // Messages
];

export default function ClientLayout() {
  return <DashboardShell title="Client Dashboard" navItems={navItems} tabItems={tabItems} />;
}
