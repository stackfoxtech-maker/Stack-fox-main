import { useEffect, useState } from 'react';
import { Gift, Copy, Check, Users } from 'lucide-react';
import { Badge, EmptyState, Spinner } from '@components/ui/Primitives';
import { formatINR, formatDate, copyToClipboard } from '@lib/utils';
import api from '@lib/api';

const statusMap = { pending: 'warning', signed_up: 'info', converted: 'success' };
const statusLabel = { pending: 'Pending', signed_up: 'Signed Up', converted: 'Converted' };

export default function Referrals() {
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [refRes, statsRes] = await Promise.all([
          api.get('/referrals'),
          api.get('/referrals/stats'),
        ]);

        const refData = refRes.data.data || refRes.data.items || refRes.data || [];
        setReferrals(Array.isArray(refData) ? refData : []);

        const statsData = statsRes.data.data || statsRes.data.items || statsRes.data || {};
        setStats(statsData);
      } catch {
        setReferrals([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const copyLink = async () => {
    const link = stats?.referralLink || `https://stackfox.com/ref/${stats?.referralCode || 'CLIENT'}`;
    const success = await copyToClipboard(link);
    setCopied(success);
    if (success) {
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalEarnings = referrals.reduce((s, r) => s + (r.earning || r.rewardAmount || 0), 0);
  const converted = referrals.filter((r) => r.status === 'converted').length;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-warm-900">Referral Program</h2>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-fox-500/10 flex items-center justify-center">
            <Gift size={20} className="text-fox-500" />
          </div>
          <div>
            <h3 className="font-medium text-warm-900">Your Referral Link</h3>
            <p className="text-xs text-warm-500">Earn {formatINR(stats?.rewardAmount || 5000)} for every converted referral</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-warm-50 rounded-xl px-4 py-2.5 text-sm text-warm-600 truncate">{stats?.referralLink || 'Loading...'}</code>
          <button onClick={copyLink} className="shrink-0 px-4 py-2.5 rounded-xl bg-fox-500 text-white text-sm font-medium hover:bg-fox-600 transition flex items-center gap-1.5">
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Referrals', value: stats?.totalReferrals ?? referrals.length },
          { label: 'Converted', value: stats?.converted ?? converted },
          { label: 'Total Earnings', value: formatINR(stats?.totalEarnings ?? totalEarnings) },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-warm-200 p-5 text-center">
            <div className="text-xs text-warm-500">{s.label}</div>
            <div className="text-xl font-bold text-warm-900 mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {referrals.length === 0 ? (
        <EmptyState icon={Users} title="No referrals yet" description="Share your link to start earning rewards." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-200 divide-y divide-warm-100">
          {referrals.map((r) => (
            <div key={r._id || r.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-warm-900 text-sm">{r.name || r.clientName}</p>
                <p className="text-xs text-warm-500">{r.email} &middot; {formatDate(r.createdAt || r.date)}</p>
              </div>
              <div className="flex items-center gap-3">
                {(r.earning || r.rewardAmount || 0) > 0 && <span className="text-sm font-mono font-semibold text-green-600">+{formatINR(r.earning || r.rewardAmount || 0)}</span>}
                <Badge variant={statusMap[r.status] || 'neutral'}>{statusLabel[r.status] || r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
