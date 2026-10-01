import { useEffect, useState } from 'react';
import { Gift, Users, UserPlus, Copy, Check, Share2, MessageCircle, Mail } from 'lucide-react';
import { Badge, EmptyState, Spinner, PanelSkeleton } from '@components/ui/Primitives';
import { formatINR, formatPaise, formatDate } from '@lib/utils';
import api from '@lib/api';
import toast from 'react-hot-toast';

// Referral.status is written in upper case by the API (PENDING|SENT|DUPLICATE|
// CONVERTED|PAID|EXPIRED) — these keys used to be lower case with different
// words ('signed_up' for what the API calls SENT), so every badge fell
// through to the 'neutral'/raw-code fallback below.
const statusMap = {
  PENDING: 'warning',
  SENT: 'info',
  CONVERTED: 'success',
  PAID: 'success',
  DUPLICATE: 'neutral',
  EXPIRED: 'neutral',
};
const statusLabel = {
  PENDING: 'Pending',
  SENT: 'Invite Sent',
  CONVERTED: 'Converted',
  PAID: 'Paid Out',
  DUPLICATE: 'Already a Member',
  EXPIRED: 'Expired',
};

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState({ referredName: '', referredEmail: '' });
  const [inviting, setInviting] = useState(false);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    fetchData();
    api
      .get('/referrals/link')
      .then((r) => setShare(r.data.data))
      .catch(() => {});
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.');
    }
  };

  // The phone's own share sheet (WhatsApp, Messages, anything installed), where it exists.
  const nativeShare = () =>
    navigator.share({ title: 'StackFox', text: share.message, url: share.url }).catch(() => {});

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!invite.referredEmail.trim()) {
      toast.error('An email is required.');
      return;
    }
    setInviting(true);
    try {
      await api.post('/referrals', invite);
      toast.success(`Invite sent to ${invite.referredEmail}`);
      setInvite({ referredName: '', referredEmail: '' });
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send that invite.');
    } finally {
      setInviting(false);
    }
  };

  const converted = referrals.filter((r) => r.status === 'CONVERTED' || r.status === 'PAID').length;

  if (loading) return <PanelSkeleton variant="stack" />;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-warm-900">Referral Program</h2>

      {share && (
        <div className="rounded-2xl border border-fox-200 bg-fox-50/60 p-5 sm:p-6">
          <h3 className="font-semibold text-warm-900">Your referral link</h3>
          <p className="mt-0.5 text-xs text-warm-600">
            Send it to anyone, on WhatsApp or anywhere else. You earn a commission when they pay for
            their first order.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={share.url}
              onFocus={(e) => e.target.select()}
              aria-label="Your referral link"
              className="input-fx min-w-0 flex-1 font-mono text-sm"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-warm-200 bg-white px-4 text-sm font-semibold text-warm-800 transition hover:border-fox-300"
            >
              {copied ? <Check size={16} className="text-success-500" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <a
              href={share.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:brightness-95"
            >
              <MessageCircle size={16} /> Share on WhatsApp
            </a>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                type="button"
                onClick={nativeShare}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-warm-200 bg-white px-4 text-sm font-semibold text-warm-800"
              >
                <Share2 size={16} /> Share…
              </button>
            )}
            <a
              href={share.mailtoUrl}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-warm-200 bg-white px-4 text-sm font-semibold text-warm-800"
            >
              <Mail size={16} /> Email
            </a>
          </div>
          <p className="mt-2.5 text-[11px] text-warm-500">
            Your code: <span className="font-mono font-semibold text-warm-700">{share.code}</span>
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-fox-500/10 flex items-center justify-center">
            <Gift size={20} className="text-fox-500" />
          </div>
          <div>
            <h3 className="font-medium text-warm-900">Invite a friend</h3>
            <p className="text-xs text-warm-500">
              Earn a commission on the order they pay once it converts.
            </p>
          </div>
        </div>
        <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Their name (optional)"
            value={invite.referredName}
            onChange={(e) => setInvite({ ...invite, referredName: e.target.value })}
            className="input-fx flex-1"
          />
          <input
            type="email"
            required
            placeholder="Their email"
            value={invite.referredEmail}
            onChange={(e) => setInvite({ ...invite, referredEmail: e.target.value })}
            className="input-fx flex-1"
          />
          <button
            type="submit"
            disabled={inviting}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-fox-500 text-white text-sm font-medium hover:bg-fox-600 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {inviting ? <Spinner size="sm" /> : <UserPlus size={16} />}
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {[
          { label: 'Total Referrals', value: stats?.total ?? referrals.length },
          { label: 'Converted', value: stats?.converted ?? converted },
          { label: 'Total Earnings', value: formatINR(stats?.totalEarnings ?? 0) },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border border-warm-200 p-5 text-center"
          >
            <div className="text-xs text-warm-500">{s.label}</div>
            <div className="text-xl font-bold text-warm-900 mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {referrals.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No referrals yet"
          description="Share your link to start earning rewards."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-200 divide-y divide-warm-100">
          {referrals.map((r) => (
            <div key={r._id || r.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-warm-900 text-sm">
                  {r.referredName || r.referredEmail}
                </p>
                <p className="text-xs text-warm-500">
                  {r.referredEmail} &middot; {formatDate(r.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* commissionAmount is paise — formatPaise, not formatINR. */}
                {(r.commissionAmount || 0) > 0 && (
                  <span className="text-sm font-mono font-semibold text-green-600">
                    +{formatPaise(r.commissionAmount || 0)}
                  </span>
                )}
                <Badge variant={statusMap[r.status] || 'neutral'}>
                  {statusLabel[r.status] || r.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
