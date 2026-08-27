import { useEffect, useMemo, useState } from 'react';
import { Users, TrendingUp, Award, IndianRupee } from 'lucide-react';
import { Badge, EmptyState, Spinner } from '@components/ui/Primitives';
import { formatINR, formatDate, getInitials, capitalize } from '@lib/utils';
import api from '@lib/api';
import toast from 'react-hot-toast';

const payoutVariant = (status) =>
  status === 'PAID' || status === 'CONVERTED' ? 'success' : status === 'EXPIRED' || status === 'DUPLICATE' ? 'neutral' : 'warning';

export default function Referrals() {
  const [tab, setTab] = useState('leaderboard');
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/referrals').catch(() => ({ data: { data: [] } })),
      api.get('/referrals/stats').catch(() => ({ data: {} })),
    ])
      .then(([r, s]) => {
        setReferrals(r.data.data || []);
        setStats(s.data || {});
      })
      .finally(() => setLoading(false));
  }, []);

  // Aggregate referrals into a per-referrer leaderboard
  const leaderboard = useMemo(() => {
    const map = new Map();
    for (const ref of referrals) {
      const key = ref.referrerId;
      if (!map.has(key)) {
        map.set(key, {
          referrerId: key,
          name: ref.referrer?.name || 'Unknown',
          email: ref.referrer?.email || '',
          referrals: 0,
          converted: 0,
          earnings: 0,
        });
      }
      const entry = map.get(key);
      entry.referrals += 1;
      if (ref.status === 'CONVERTED') entry.converted += 1;
      entry.earnings += (ref.commissionAmount || 0) / 100;
    }
    return [...map.values()].sort((a, b) => b.earnings - a.earnings);
  }, [referrals]);

  const payouts = useMemo(
    () => referrals.filter((r) => r.commissionAmount).sort((a, b) => (b.commissionAmount || 0) - (a.commissionAmount || 0)),
    [referrals]
  );

  const topReferrer = leaderboard[0];

  const statCards = [
    { label: 'Total Referrals', value: stats?.total ?? referrals.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Conversion Rate', value: stats?.total ? `${Math.round((stats.converted / stats.total) * 100)}%` : '0%', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Top Referrer', value: topReferrer?.name ? topReferrer.name.split(' ')[0] + '.' : '—', icon: Award, color: 'text-amber-600 bg-amber-50' },
    { label: 'Total Earnings', value: formatINR((stats?.totalEarnings || 0) / 100), icon: IndianRupee, color: 'text-fox-500 bg-fox-500/10' },
  ];

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-warm-900">Referral Program</h2>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-warm-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}><s.icon size={18} /></div>
            </div>
            <div className="text-xl font-bold text-warm-900">{s.value}</div>
            <div className="text-xs text-warm-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-warm-50 rounded-xl p-1">
        {['leaderboard', 'payouts'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? 'bg-white text-fox-500 shadow-sm' : 'text-warm-500 hover:text-warm-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' && (
        leaderboard.length === 0 ? (
          <EmptyState icon={Users} title="No referrals yet" description="Referral activity will appear here once users start referring." />
        ) : (
          <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
            <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-warm-50 text-xs font-semibold text-warm-500 uppercase tracking-wide">
              <span>#</span><span>Referrer</span><span>Referrals</span><span>Converted</span><span>Earnings</span>
            </div>
            {leaderboard.map((r, i) => (
              <div key={r.referrerId} className="grid grid-cols-[40px_2fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-warm-100 items-center">
                <span className={`text-sm font-bold ${i < 3 ? 'text-fox-500' : 'text-warm-400'}`}>{i + 1}</span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-fox-500/10 flex items-center justify-center text-fox-500 text-xs font-bold">{getInitials(r.name)}</div>
                  <span className="text-sm font-medium text-warm-900">{r.name}</span>
                </div>
                <span className="text-sm text-warm-600">{r.referrals}</span>
                <span className="text-sm text-warm-600">{r.converted}</span>
                <span className="text-sm font-mono font-semibold text-warm-900">{formatINR(r.earnings)}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'payouts' && (
        payouts.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No payouts yet" description="Commission payouts will appear here once referrals convert." />
        ) : (
          <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-warm-50 text-xs font-semibold text-warm-500 uppercase tracking-wide">
              <span>Referrer</span><span>Amount</span><span>Status</span><span>Date</span>
            </div>
            {payouts.map((p) => (
              <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-warm-100 items-center">
                <span className="text-sm font-medium text-warm-900">{p.referrer?.name || 'Unknown'}</span>
                <span className="text-sm font-mono text-warm-800">{formatINR((p.commissionAmount || 0) / 100)}</span>
                <Badge variant={payoutVariant(p.status)}>{capitalize(p.status.toLowerCase())}</Badge>
                <span className="text-xs text-warm-500">{formatDate(p.sentAt || p.createdAt)}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
