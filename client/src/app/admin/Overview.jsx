import { useEffect, useState } from 'react';
import { DollarSign, FolderKanban, Users, LifeBuoy, TrendingUp, Receipt, UserPlus } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatINRShort } from '@lib/utils';
import { Spinner } from '@components/ui/Primitives';
import api from '@lib/api';

const KPI = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-2xl border border-warm-200 p-5">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={20} /></div>
    </div>
    <div className="text-2xl font-bold font-mono text-warm-900">{value}</div>
    <div className="text-xs text-warm-500 mt-1">{label}</div>
    {sub && <div className="text-[10px] text-warm-400 mt-0.5">{sub}</div>}
  </div>
);

export default function Overview() {
  usePageTitle('Admin Overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/overview').then((r) => setData(r.data.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const d = data || { totalRevenue: 0, monthRevenue: 0, activeProjects: 0, pendingInvoices: 0, totalClients: 0, openTickets: 0, teamCount: 0 };

  return (
    <div className="space-y-6">
      <h2 className="text-display-sm text-warm-900">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total revenue" value={formatINRShort(d.totalRevenue)} icon={DollarSign} color="bg-success-50 text-success-700" sub={`This month: ${formatINRShort(d.monthRevenue)}`} />
        <KPI label="Active projects" value={d.activeProjects} icon={FolderKanban} color="bg-info-50 text-info-700" />
        <KPI label="Clients" value={d.totalClients} icon={Users} color="bg-fox-50 text-fox-600" />
        <KPI label="Open tickets" value={d.openTickets} icon={LifeBuoy} color="bg-warning-50 text-warning-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-1">Pending invoices</h3>
          <div className="text-3xl font-bold font-mono text-fox-500">{d.pendingInvoices}</div>
          <p className="text-xs text-warm-500 mt-1">Awaiting payment</p>
        </div>
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-1">Team members</h3>
          <div className="text-3xl font-bold font-mono text-warm-900">{d.teamCount}</div>
          <p className="text-xs text-warm-500 mt-1">Active developers</p>
        </div>
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-1">Revenue trend</h3>
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-success-500" />
            <span className="text-sm text-warm-600">Growing month over month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
