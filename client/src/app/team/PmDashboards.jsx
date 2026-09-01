import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export function Queue() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/projects', { params: { status: 'PENDING' } }).then((r) => {
      const items = r.data.data || r.data.items || r.data;
      setProjects(Array.isArray(items) ? items : []);
    }).catch(() => toast.error('Failed to load project queue.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const queue = projects.filter((p) => p.status === 'DRAFT' || p.status === 'PENDING');

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H1 &middot; Order and Project Queue</p>
      <h1 className="text-2xl font-bold mb-6">Incoming Projects</h1>
      <p className="text-gray-600 mb-6">New orders awaiting kickoff. Sorted by earliest commitment date.</p>
      {queue.length === 0 ? (
        <EmptyState title="No projects in queue" description="Projects with DRAFT or PENDING status will appear here." />
      ) : (
        <div className="space-y-3">
          {queue.map((p) => (
            <div key={p.id || p._id} className="border rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="font-semibold">{p.projectNumber || p.id || p._id}: {p.title || p.service?.name || 'Untitled'}</div>
                <div className="text-sm text-gray-500">Status: {p.status} &middot; {p.milestones?.length || 0} milestones</div>
              </div>
              <div className="text-right">
                <Link to={'/builder?service=' + (p.id || p._id)} className="text-xs text-orange-600 hover:underline">Open Builder</Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Link to="/app/team/projects" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">Back to projects</Link>
      </div>
    </div>
  );
}

export function Sprints() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks/my').then((r) => setTasks(r.data.data?.tasks || [])).catch(() => toast.error('Failed to load sprints.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const statusGroups = {};
  tasks.forEach((t) => {
    const s = t.status || 'todo';
    if (!statusGroups[s]) statusGroups[s] = [];
    statusGroups[s].push(t);
  });

  const sprintData = Object.entries(statusGroups).map(([status, ts]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
    status: status === 'done' ? 'completed' : status === 'in-progress' ? 'in-progress' : 'active',
    tasks: ts.length,
    done: ts.filter((t) => t.status === 'done').length,
  }));

  const totalTasks = tasks.length;
  const totalDone = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H2 &middot; Sprint and Task Management</p>
      <h1 className="text-2xl font-bold mb-6">Sprints</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{totalTasks}</div>
          <div className="text-xs text-gray-500">Total tasks</div>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totalDone}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{sprintData.length}</div>
          <div className="text-xs text-gray-500">Active statuses</div>
        </div>
      </div>
      {sprintData.length === 0 ? (
        <EmptyState title="No tasks yet" description="Tasks will appear here when assigned to you." />
      ) : (
        <div className="space-y-4 mb-6">
          {sprintData.map((s) => (
            <div key={s.name} className="border rounded-xl p-4">
              <div className="flex justify-between font-semibold">
                <span>{s.name}</span>
                <span className={s.status === 'completed' ? 'text-green-700' : 'text-orange-700'}>{s.status}</span>
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: s.tasks > 0 ? Math.round((s.done / s.tasks) * 100) + '%' : '0%' }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{s.done}/{s.tasks} tasks done</div>
            </div>
          ))}
        </div>
      )}
      <Link to="/app/team/tasks" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">View all tasks</Link>
    </div>
  );
}

export function Resources() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ capacity: 8, totalOpenTasks: 0, unassigned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Real per-person capacity, computed server-side across every open task.
    // This used to read /tasks/my — the viewer's own tasks — and spread that
    // one number across the whole team, so every load figure was wrong.
    api.get('/tasks/workload')
      .then((r) => {
        setRows(r.data.data || []);
        setMeta(r.data.meta || {});
      })
      .catch((e) => setError(
        e.response?.status === 403
          ? 'Team resources are visible to StackFox staff only.'
          : 'Could not load team capacity.',
      ))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const tone = (load) => (load > 90 ? 'red' : load > 70 ? 'orange' : 'green');

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H3 &middot; Resource Allocation</p>
      <h1 className="text-2xl font-bold mb-2">Team Resources</h1>
      <p className="text-gray-600 mb-6">
        Open workload per person against a comfortable ceiling of {meta.capacity} tasks.
        Red means over-allocated.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              ['Open tasks', meta.totalOpenTasks ?? 0],
              ['Team members', rows.length],
              ['Over capacity', rows.filter((r) => r.load > 100).length],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border rounded-xl p-4">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-xl font-bold font-mono mt-1">{value}</div>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No staff found" description="Team members appear here once they have accounts." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="border rounded-xl p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.role}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={
                        tone(r.load) === 'red' ? 'text-red-700 font-semibold'
                          : tone(r.load) === 'orange' ? 'text-orange-700 font-semibold'
                          : 'text-green-700 font-semibold'
                      }>{r.load}%</span>
                      <div className="text-xs text-gray-500">
                        {r.openTasks} open{r.overdue > 0 && <span className="text-red-600"> &middot; {r.overdue} overdue</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        tone(r.load) === 'red' ? 'bg-red-500'
                          : tone(r.load) === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, r.load)}%` }}
                    />
                  </div>
                  {r.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.skills.slice(0, 6).map((sk) => (
                        <span key={sk} className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{sk}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Quality() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tickets').then((r) => {
      const items = r.data.data || r.data.items || r.data;
      setTickets(Array.isArray(items) ? items : []);
    }).catch(() => toast.error('Failed to load tickets.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'acknowledged' || t.status === 'in-progress');

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H4 &middot; Quality Assurance</p>
      <h1 className="text-2xl font-bold mb-6">QA Dashboard</h1>
      <p className="text-gray-600 mb-6">Open bugs and quality signals for active projects.</p>
      {openTickets.length === 0 ? (
        <EmptyState title="No open tickets" description="All tickets are resolved or none have been created yet." />
      ) : (
        <div className="space-y-3">
          {openTickets.map((b) => (
            <div key={b.id || b._id} className="border rounded-xl p-4 flex justify-between">
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.severity === 'Critical' || b.severity === 'P1' ? 'bg-red-100 text-red-700' : b.severity === 'High' || b.severity === 'P2' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.severity || 'Medium'}</span>
                <span className="font-medium ml-2">{b.title || b.description}</span>
              </div>
              <span className="text-sm text-gray-500">{b.project?.projectNumber || b.projectId || '—'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Link to="/app/team/tasks" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">Back to tasks</Link>
      </div>
    </div>
  );
}

export function Finance() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/invoices').then((r) => {
      const items = r.data.data || r.data.items || r.data;
      setInvoices(Array.isArray(items) ? items : []);
    }).catch(() => toast.error('Failed to load invoices.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || i.grandTotal || 0), 0);

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H5 &middot; Financial Operations</p>
      <h1 className="text-2xl font-bold mb-6">Finance</h1>
      <p className="text-gray-600 mb-6">Revenue, payouts, and invoice reconciliation for the team.</p>
      <div className="bg-white border rounded-xl p-4 mb-6">
        <div className="text-2xl font-bold text-green-600">Rs {(totalRevenue / 100000).toFixed(1)}L</div>
        <div className="text-xs text-gray-500">Revenue this month (from paid invoices)</div>
      </div>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" description="Invoices will appear here once created." />
      ) : (
        <div className="space-y-3">
          {invoices.map((i) => (
            <div key={i.id || i._id} className="border rounded-xl p-4 flex justify-between">
              <div>
                <span className="font-medium">{i.invoiceNumber || i.id || i._id}</span>
                <span className="text-sm text-gray-500 ml-2">{i.project?.projectNumber || i.engagement?.projectNumber || '—'}</span>
              </div>
              <div className="text-right">
                <div className="font-bold">Rs {((i.total || i.grandTotal || 0) / 100000).toFixed(1)}L</div>
                <span className={`text-xs ${i.status === 'paid' ? 'text-green-700' : 'text-orange-700'}`}>{i.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Link to="/app/admin/finance" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">Admin finance panel</Link>
      </div>
    </div>
  );
}

export function Clients() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/projects').then((r) => {
      const items = r.data.data || r.data.items || r.data;
      setProjects(Array.isArray(items) ? items : []);
    }).catch(() => toast.error('Failed to load clients.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const clientMap = {};
  projects.forEach((p) => {
    const orgName = p.engagement?.client?.name || p.engagement?.org?.name || p.org?.name || 'Unknown Client';
    const clientId = p.engagement?.clientId || p.engagement?.orgId || p.orgId || 'unknown';
    if (!clientMap[clientId]) clientMap[clientId] = { name: orgName, id: clientId, projects: 0, status: p.status };
    clientMap[clientId].projects += 1;
  });
  const clients = Object.values(clientMap);

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H6 &middot; Client Relationship</p>
      <h1 className="text-2xl font-bold mb-6">Clients</h1>
      <p className="text-gray-600 mb-6">All client accounts and active engagements in one view.</p>
      {clients.length === 0 ? (
        <EmptyState title="No clients" description="Clients will appear here once projects are created." />
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.id} className="border rounded-xl p-4 flex justify-between">
              <div>
                <span className="font-semibold">{c.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2">{c.id}</span>
              </div>
              <div className="text-right">
                <div className="text-sm">{c.projects} active projects</div>
                <span className={`text-xs font-medium ${c.status === 'active' || c.status === 'IN_PROGRESS' ? 'text-green-700' : 'text-yellow-700'}`}>{c.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Link to="/app/team/projects" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">Back to projects</Link>
      </div>
    </div>
  );
}

export function Analysis() {
  const [analytics, setAnalytics] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/revenue'),
    ]).then(([overviewRes, revenueRes]) => {
      setAnalytics(overviewRes.data);
      setRevenue(revenueRes.data || []);
    }).catch(() => toast.error('Failed to load analytics.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const maxRevenue = Math.max(...revenue.map((r) => r.value || 0), 1);

  const metrics = analytics ? [
    { metric: 'Active projects', value: analytics.totalProjects || 0 },
    { metric: 'Total revenue', value: 'Rs ' + (analytics.totalRevenue ? (analytics.totalRevenue / 100000).toFixed(1) + 'L' : '0') },
    { metric: 'Active clients', value: analytics.activeClients || 0 },
    { metric: 'Pending invoices', value: analytics.pendingInvoices || 0 },
  ] : [];

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">H7 &middot; Analytics and Reporting</p>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <p className="text-gray-600 mb-6">Key delivery metrics across the whole team.</p>
      {metrics.length === 0 ? (
        <EmptyState title="No analytics data" description="Analytics will appear here once data is available." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {metrics.map((a) => (
              <div key={a.metric} className="bg-[#FAFAF8] border rounded-xl p-5 text-center">
                <div className="text-2xl font-extrabold text-orange-600">{a.value}</div>
                <div className="text-xs text-gray-500 mt-1">{a.metric}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-warm-700 mb-4">Revenue Trend (Last 6 Months)</h3>
            {revenue.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No revenue data available.</p>
            ) : (
              <div className="flex items-end gap-2 h-32">
                {revenue.map((r, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-gray-500">Rs {(r.value / 1000).toFixed(0)}K</div>
                    <div className="w-full bg-orange-500 rounded-t-md transition-all" style={{ height: maxRevenue > 0 ? Math.max(4, (r.value / maxRevenue) * 100) + '%' : '4px' }} />
                    <div className="text-[9px] text-gray-400 truncate w-full text-center">{r.label?.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <div className="mt-6">
        <Link to="/app/admin/analytics" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">Admin analytics</Link>
      </div>
    </div>
  );
}
