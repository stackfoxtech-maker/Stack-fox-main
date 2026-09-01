import { useEffect, useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, UserPlus, Mic, Phone, Calendar, FileText, TrendingUp, Target, Award, XCircle, BarChart3, Plus, ArrowRight, BookOpen, Lightbulb, ThumbsUp, ThumbsDown, RotateCcw, Share2, Printer } from 'lucide-react';
import { businessCategories, getPitch } from '@data/salesPitchLibrary';
import { apiGet } from '@lib/api';
import { toast } from 'react-hot-toast';

const lakhs = (rupees) => (rupees >= 100000 ? `₹${(rupees / 100000).toFixed(1)}L` : `₹${(rupees / 1000).toFixed(0)}K`);

function buildKpis(s) {
  s = s ?? {};
  return [
    { label: 'Total Leads', value: String(s.totalLeads ?? 0), icon: Users, color: 'text-info-500' },
    { label: 'New Leads', value: String(s.newLeads ?? 0), icon: UserPlus, color: 'text-success-500' },
    { label: 'Follow-ups Due', value: String(s.followUpsToday ?? 0), icon: Calendar, color: 'text-warning-500' },
    { label: 'In Progress', value: String(s.inProgress ?? 0), icon: TrendingUp, color: 'text-info-500' },
    { label: 'Deals Won', value: String(s.won ?? 0), icon: Award, color: 'text-success-500' },
    { label: 'Deals Lost', value: String(s.lost ?? 0), icon: XCircle, color: 'text-danger-500' },
    { label: 'Month Value Won', value: lakhs(s.monthlyValueWon ?? 0), icon: BarChart3, color: 'text-fox-500' },
    { label: 'Monthly Target', value: s.monthlyTarget ? lakhs(s.monthlyTarget) : '—', icon: Target, color: 'text-warning-500' },
    { label: 'Conversion Rate', value: `${s.conversionRate ?? 0}%`, icon: TrendingUp, color: 'text-success-500' },
  ];
}

const quickActions = [
  { label: 'Add New Lead', icon: UserPlus, path: '/app/team/sales/leads', color: 'bg-fox-500 hover:bg-fox-600 text-white' },
  { label: 'Generate / View Pitch', icon: Mic, path: '/app/team/sales/pitch-studio', color: 'bg-info-500 hover:bg-info-600 text-white' },
  { label: 'Start Sales Call', icon: Phone, path: '/app/team/sales/sales-call', color: 'bg-success-500 hover:bg-success-600 text-white' },
  { label: 'Add Follow-Up', icon: Calendar, path: '/app/team/sales/follow-ups', color: 'bg-warning-500 hover:bg-warning-600 text-white' },
  { label: 'Create Proposal', icon: FileText, path: '/app/team/sales/proposals', color: 'bg-fox-600 hover:bg-fox-700 text-white' },
  { label: 'View Pitch Library', icon: BookOpen, path: '/app/team/sales/knowledge-center', color: 'bg-warm-700 hover:bg-warm-800 text-white' },
];

const coachingTips = [
  'You have 3 follow-ups today. Try using the Quick Pitch Generator to prepare a personalized pitch before each call.',
  'Your conversion rate is 31%. Consider using the Objections page to prepare for common client concerns.',
  'You have 5 new leads this week. Use the Pitch Studio to generate category-specific pitches for each lead.',
  'You won 4 deals this month. Review your winning pitches in Pitch History to see what worked best.',
  'You have 2 meetings scheduled today. Use the Sales Call assistant to prepare a structured script.',
  'Your monthly target is ₹3L and you are at ₹2.4L. Focus on warm leads and use the ROI calculator in Pitch Studio.',
  'You have 8 deals in progress. Use the Follow-Up page to schedule timely follow-ups and move deals forward.',
  'Try the new WhatsApp pitch mode in Pitch Studio to send quick, personalized pitches to clients.',
];

const pitchOfTheDayCategories = ['gym', 'restaurant', 'cafe', 'hospital', 'clinic', 'hotel', 'real-estate'];

export default function SalesDashboard() {
  const [quickCategory, setQuickCategory] = useState('');
  const [coachingDismissed, setCoachingDismissed] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiGet('/leads/stats', { mine: '1' })
      .then((r) => setStats(r.data?.data ?? null))
      .catch(() => { /* KPIs just render as em-dashes */ });
  }, []);

  const kpis = buildKpis(stats);
  const quickPitch = quickCategory ? getPitch(quickCategory) : null;
  const pitchOfTheDay = useMemo(() => {
    const dayIndex = new Date().getDate() % pitchOfTheDayCategories.length;
    return getPitch(pitchOfTheDayCategories[dayIndex]);
  }, []);
  const todaysCoaching = coachingTips[new Date().getDay() % coachingTips.length];

  const handleFeedback = (type) => {
    toast.success('Thanks for your feedback!');
  };

  const sharePitchOfTheDay = () => {
    if (!pitchOfTheDay) return;
    const text = encodeURIComponent(pitchOfTheDay.shortPitch + '\n\n' + pitchOfTheDay.whatsappPitch);
    window.open('https://wa.me/?text=' + text, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Sales Overview</h2>
        <p className="text-warm-500 text-sm mt-1">Track your leads, deals, and performance</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-sm transition">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl bg-warm-50 ${kpi.color}`}>
                <kpi.icon size={20} />
              </div>
              <span className="text-xs text-warm-500 font-medium">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-warm-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      {!coachingDismissed && (
        <div className="bg-fox-50 border border-fox-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2 rounded-xl bg-fox-500 text-white flex-shrink-0">
            <Lightbulb size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-fox-800">Today's Coaching Tip</p>
            <p className="text-sm text-fox-700 mt-1">{todaysCoaching}</p>
          </div>
          <button onClick={() => setCoachingDismissed(true)} className="text-warm-400 hover:text-warm-600 flex-shrink-0">
            <RotateCcw size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-warm-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action) => (
            <NavLink key={action.label} to={action.path} className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className={`p-3 rounded-2xl ${action.color}`}>
                <action.icon size={24} />
              </div>
              <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-900">Quick Pitch Generator</h3>
          <NavLink to="/app/team/sales/pitch-studio" className="text-xs text-fox-500 hover:underline flex items-center gap-1">Open Pitch Studio <ArrowRight size={12} /></NavLink>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Select Category</label>
            <select value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)} className="input-fx">
              <option value="">Choose category</option>
              {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Quick Pitch Preview</label>
            <div className="bg-warm-50 border border-warm-200 rounded-xl p-4">
              {quickPitch ? (
                <div>
                  <p className="text-sm font-medium text-fox-700 mb-1">{quickPitch.categoryName}</p>
                  <p className="text-sm text-warm-700 leading-relaxed mb-2">{quickPitch.shortPitch}</p>
                  <div className="flex items-center gap-4 text-xs text-warm-500">
                    <span>ROI: {quickPitch.roiProjection}</span>
                    <span>Quick win: {quickPitch.quickWin}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-warm-500">Pick a category above to see a ready-to-use short pitch, ROI, and quick win.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-900">Pitch of the Day</h3>
          <button onClick={sharePitchOfTheDay} className="text-xs text-fox-500 hover:text-fox-700 flex items-center gap-1">
            <Share2 size={12} /> Share
          </button>
        </div>
        <div className="bg-gradient-to-r from-fox-50 to-info-50 border border-fox-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-fox-700 bg-fox-100 px-2 py-0.5 rounded-lg">{pitchOfTheDay?.categoryName}</span>
            <span className="text-xs text-warm-500">Recommended for today</span>
          </div>
          <p className="text-sm text-warm-700 leading-relaxed mb-3">{pitchOfTheDay?.mainPitch}</p>
          <div className="flex items-center gap-3 text-xs text-warm-500">
            <span>ROI: {pitchOfTheDay?.roiProjection}</span>
            <span>Quick win: {pitchOfTheDay?.quickWin}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-warm-500">Was this helpful?</span>
            <button onClick={() => handleFeedback('yes')} className="text-xs px-2 py-1 rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200 transition">Yes</button>
            <button onClick={() => handleFeedback('no')} className="text-xs px-2 py-1 rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200 transition">No</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-900">Recent Leads</h3>
            <NavLink to="/app/team/sales/leads" className="text-xs text-fox-500 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></NavLink>
          </div>
          <div className="space-y-3">
            {[
              { name: 'FitZone Gym', category: 'Gym', status: 'New Lead', date: 'Today' },
              { name: 'Spice Garden Restaurant', category: 'Restaurant', status: 'Interested', date: 'Yesterday' },
              { name: 'Patna Dental Care', category: 'Dental Clinic', status: 'Meeting Scheduled', date: '2 days ago' },
              { name: 'City Plaza Hotel', category: 'Hotel', status: 'Proposal Sent', date: '3 days ago' },
            ].map((lead) => (
              <div key={lead.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-warm-50 transition">
                <div>
                  <p className="text-sm font-medium text-warm-900">{lead.name}</p>
                  <p className="text-xs text-warm-500">{lead.category}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-fox-600 bg-fox-50 px-2 py-1 rounded-lg">{lead.status}</span>
                  <p className="text-xs text-warm-400 mt-1">{lead.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-900">Today's Follow-ups</h3>
            <NavLink to="/app/team/sales/follow-ups" className="text-xs text-fox-500 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></NavLink>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Rajesh Kumar', business: 'Kumar Electronics', action: 'Call to discuss proposal', type: 'Call' },
              { name: 'Priya Sharma', business: 'Sharma Cafe', action: 'Send website mockup', type: 'WhatsApp' },
              { name: 'Amit Singh', business: 'Singh Real Estate', action: 'Schedule site visit', type: 'Meeting' },
            ].map((followup, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-warm-50 transition">
                <div>
                  <p className="text-sm font-medium text-warm-900">{followup.name}</p>
                  <p className="text-xs text-warm-500">{followup.business}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-warm-600">{followup.action}</p>
                  <span className="text-xs text-warm-400">{followup.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
