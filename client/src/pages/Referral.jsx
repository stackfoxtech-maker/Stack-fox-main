import { useState } from 'react';
import { Gift, Link2, Copy, Check, Users, IndianRupee, ArrowRight } from 'lucide-react';

const steps = [
  { icon: Link2, title: 'Share Your Link', desc: 'Copy your unique referral link and share it with businesses you know.' },
  { icon: Users, title: 'They Sign Up', desc: 'When someone signs up and makes their first purchase using your link, it counts.' },
  { icon: IndianRupee, title: 'You Earn ₹5,000', desc: 'Get ₹5,000 credited for every successful referral. No cap on earnings.' },
];

const mockReferrals = [
  { name: 'Priya Sharma', date: '2026-08-15', status: 'Converted', earned: 5000 },
  { name: 'Rahul Mehta', date: '2026-08-10', status: 'Converted', earned: 5000 },
  { name: 'Ankit Verma', date: '2026-08-05', status: 'Pending', earned: 0 },
  { name: 'Neha Gupta', date: '2026-07-28', status: 'Converted', earned: 5000 },
  { name: 'Rohan Das', date: '2026-07-20', status: 'Expired', earned: 0 },
];

const statusStyle = { Converted: 'bg-green-100 text-green-700', Pending: 'bg-yellow-100 text-yellow-700', Expired: 'bg-warm-100 text-warm-500' };

export default function Referral() {
  const [copied, setCopied] = useState(false);
  const link = 'https://stackfox.com/r/USER2026X';
  const totalEarned = mockReferrals.reduce((s, r) => s + r.earned, 0);

  const copyLink = () => {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-warm-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-fox-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="text-fox-500" size={26} />
          </div>
          <h1 className="text-3xl font-bold text-warm-900 mb-2">Referral Program</h1>
          <p className="text-warm-500 max-w-lg mx-auto">Earn ₹5,000 for every business you refer to StackFox. No limits, no strings.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {steps.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-warm-200 p-6 text-center">
              <div className="w-12 h-12 bg-fox-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <s.icon className="text-fox-500" size={22} />
              </div>
              <h3 className="font-semibold text-warm-900 mb-1">Step {i + 1}: {s.title}</h3>
              <p className="text-sm text-warm-500">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-warm-900 mb-3">Your Referral Link</h2>
          <div className="flex gap-2">
            <input readOnly value={link} className="flex-1 bg-warm-50 border border-warm-200 rounded-lg px-4 py-2.5 text-sm text-warm-700 font-mono" />
            <button onClick={copyLink} className="flex items-center gap-1.5 bg-fox-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-fox-600 transition">
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Referrals', value: mockReferrals.length },
            { label: 'Converted', value: mockReferrals.filter(r => r.status === 'Converted').length },
            { label: 'Total Earned', value: `₹${totalEarned.toLocaleString()}` },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-warm-200 p-5 text-center">
              <p className="text-2xl font-bold text-fox-500">{stat.value}</p>
              <p className="text-sm text-warm-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <h2 className="text-lg font-semibold text-warm-900 mb-4">Referral History</h2>
          <div className="space-y-3">
            {mockReferrals.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-warm-100 last:border-0">
                <div>
                  <p className="font-medium text-warm-900">{r.name}</p>
                  <p className="text-xs text-warm-500">{r.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[r.status]}`}>{r.status}</span>
                  {r.earned > 0 && <span className="text-sm font-semibold text-green-600">+₹{r.earned.toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-fox-500/5 border border-fox-500/20 rounded-2xl p-5 text-sm text-warm-700">
          <p className="font-semibold text-warm-900 mb-1">Payout Information</p>
          <p>Earnings are paid out monthly via UPI or bank transfer. Minimum payout threshold is ₹5,000. Payouts are processed on the 1st of every month for the previous month's conversions.</p>
        </div>
      </div>
    </div>
  );
}
