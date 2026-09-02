import {
  LayoutDashboard, Package, ShoppingBag, FolderKanban, Users, Briefcase, FileText,
  BarChart3, Settings, Globe, IndianRupee, Handshake, Bell, FileSearch, Gift,
  ClipboardList, Layers, Flag, Mail, CalendarClock, ShieldCheck, ScrollText,
} from 'lucide-react';
import DashboardShell from '@app/DashboardShell';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/app/admin' },
  { label: 'Catalog', icon: Package, path: '/app/admin/catalog' },
  { label: 'Orders', icon: ShoppingBag, path: '/app/admin/orders' },
  { label: 'Purchases', icon: ScrollText, path: '/app/admin/purchases' },
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

const tabItems = [navItems[0], navItems[2], navItems[4], navItems[5]]; // Overview · Orders · Projects · Users

export default function AdminLayout() {
  return <DashboardShell title="Admin" navItems={navItems} tabItems={tabItems} dark />;
}
