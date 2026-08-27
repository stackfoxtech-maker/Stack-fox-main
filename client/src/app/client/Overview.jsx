import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Receipt, FileText, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, getStatusBadge, capitalize } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import useAuthStore from '@store/authStore';

const StatCard = ({ label, value, icon: Icon, color, to }) => (
  <Link to={to} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-card transition-shadow group">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} />
      </div>
      <ArrowRight size={16} className="text-warm-300 group-hover:text-fox-500 transition-colors" />
    </div>
    <div className="text-2xl font-bold font-mono text-warm-900">{value}</div>
    <div className="text-xs text-warm-500 mt-1">{label}</div>
  </Link>
);

export default function Overview() {
  usePageTitle('Dashboard');
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, quoteRes, invRes] = await Promise.all([
          api.get('/projects', { params: { limit: 5 } }),
          api.get('/quotes', { params: { limit: 5 } }),
          api.get('/invoices', { params: { limit: 5 } }),
        ]);

        setProjects(projRes.data.data || []);
        setStats({
          projects: projRes.data.meta?.pagination?.total || 0,
          quotes: quoteRes.data.meta?.pagination?.total || 0,
          invoices: invRes.data.meta?.pagination?.total || 0,
        });
      } catch {
        setStats({ projects: 0, quotes: 0, invoices: 0 });
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Welcome back, {user?.name?.split(' ')[0]}</h2>
        <p className="text-sm text-warm-500 mt-1">Here's what's happening with your projects.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Projects" value={stats?.projects || 0} icon={FolderKanban} color="bg-info-50 text-info-700" to="/app/client/projects" />
        <StatCard label="Quotes" value={stats?.quotes || 0} icon={FileText} color="bg-fox-50 text-fox-600" to="/app/client/quotes" />
        <StatCard label="Invoices" value={stats?.invoices || 0} icon={Receipt} color="bg-success-50 text-success-700" to="/app/client/invoices" />
      </div>

      {/* Recent projects */}
      <div className="bg-white rounded-2xl border border-warm-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-900">Recent projects</h3>
          <Link to="/app/client/projects" className="text-xs text-fox-500 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Create a quote from the Service Builder to start your first project." action={<Link to="/builder" className="btn-fox text-sm px-4 py-2">Browse Services</Link>} />
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <Link key={p._id} to={`/app/client/projects/${p._id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-warm-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center">
                  <FolderKanban size={18} className="text-warm-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warm-900 truncate">{p.name}</p>
                  <p className="text-xs text-warm-500">{p.id} &middot; {formatDate(p.createdAt)}</p>
                </div>
                <Badge variant={getStatusBadge(p.status)?.replace('badge-', '')}>{capitalize(p.status)}</Badge>
                <div className="text-sm font-mono text-warm-700">{p.progress || 0}%</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
