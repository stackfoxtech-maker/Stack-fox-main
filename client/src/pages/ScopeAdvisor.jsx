import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, Loader2, Wand2 } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Button } from '@components/ui/Primitives';
import SF_DATA from '@data/stackfox-data.json';
import api from '@lib/api';
import toast from 'react-hot-toast';

// AI Scope Advisor — 10-question flow (Product Bible §4.2). Output loads
// straight into the Builder via the same ?cart= base64 mechanism the
// Builder's own "Share" button already produces and decodes.
const QUESTIONS = [
  { key: 'industry', label: 'What industry are you in, and what is your business model?', placeholder: 'e.g. D2C e-commerce, B2B SaaS, healthcare clinic, marketplace, consultancy' },
  { key: 'problem', label: 'What is the core problem you want to solve, and what does success look like?', placeholder: 'e.g. No online presence, manual order tracking, 40% cart abandonment' },
  { key: 'currentState', label: 'Are you building something new, or improving an existing product/site?', placeholder: 'New build / Existing — describe current pain points and tech if any' },
  { key: 'users', label: 'Who are your primary users, and what scale are you planning for?', placeholder: 'e.g. 500 visitors/month, 50 orders/day, 10k MAU in year 1' },
  { key: 'platforms', label: 'Which platforms do you need?', placeholder: 'e.g. Responsive web, iOS, Android, WhatsApp bot, desktop app' },
  { key: 'features', label: 'What are the must-have features for launch vs nice-to-haves for later?', placeholder: 'Must-have: login, payments, dashboard. Nice-to-have: AI chat, referrals' },
  { key: 'integrations', label: 'Which external tools/services must this connect to?', placeholder: 'e.g. Razorpay/UPI, WhatsApp Business API, Google Sheets, Salesforce, Tally' },
  { key: 'compliance', label: 'Do you have any compliance, data, or security requirements?', placeholder: 'e.g. GST invoicing, GDPR, SOC2, data residency in India, role-based access' },
  { key: 'constraints', label: 'What is your budget range and desired go-live timeline?', placeholder: 'e.g. Under ₹3L, launch in 6–8 weeks, phased rollout OK' },
  { key: 'support', label: 'Will you need ongoing support after launch, and who will own this internally?', placeholder: 'e.g. Monthly retainer, our marketing team will manage, no internal dev' },
];

export default function ScopeAdvisor() {
  usePageTitle('AI Scope Advisor');
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);

  const findService = (id) => SF_DATA.services.find((s) => s.id === id);
  const catalogSlim = SF_DATA.services.map((s) => ({ id: s.id, name: s.name, catId: s.catId, price: s.price }));

  const setAnswer = (val) => setAnswers((a) => ({ ...a, [QUESTIONS[step].key]: val }));

  const next = () => {
    if (step < QUESTIONS.length - 1) setStep((s) => s + 1);
    else runAdvisor();
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const runAdvisor = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/assistant/advise', { answers, catalog: catalogSlim });
      setAdvice(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Advisor is temporarily unavailable.');
    }
    setLoading(false);
  };

  const loadIntoBuilder = (itemIds) => {
    const items = itemIds
      .map((id) => findService(id))
      .filter(Boolean)
      .map((s) => ({ itemId: s.id, itemType: 'service', name: s.name, price: s.price, quantity: 1 }));
    if (items.length === 0) {
      toast.error('No matching services found.');
      return;
    }
    const cartString = btoa(unescape(encodeURIComponent(JSON.stringify(items))));
    navigate(`/builder?cart=${cartString}`);
  };

  const totalFor = (itemIds) => itemIds.reduce((sum, id) => sum + (findService(id)?.price || 0), 0);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <Loader2 className="w-10 h-10 text-fox-500 mx-auto mb-4 animate-spin" />
        <p className="text-warm-600">Analyzing your answers…</p>
      </div>
    );
  }

  if (advice) {
    const isStarterMatch = advice.tier === 'STARTER';
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <Sparkles className="w-10 h-10 text-fox-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-warm-900">Recommended for you</h1>
        </div>

        <div className="bg-white rounded-3xl border-2 border-fox-300 p-6 mb-6">
          <span className="text-xs font-bold text-fox-500 uppercase tracking-widest">{advice.tier} tier</span>
          <p className="text-warm-700 mt-2 mb-4">{advice.rationale}</p>
          <div className="space-y-2 mb-4">
            {advice.itemIds.map((id) => {
              const s = findService(id);
              return s ? (
                <div key={id} className="flex justify-between text-sm border-b border-warm-100 pb-2">
                  <span className="text-warm-800">{s.name}</span>
                  <span className="font-mono text-warm-600">{formatINR(s.price)}</span>
                </div>
              ) : null;
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-black text-xl">{formatINR(totalFor(advice.itemIds))}</span>
            <Button variant="primary" onClick={() => loadIntoBuilder(advice.itemIds)} className="gap-2">
              {isStarterMatch ? `Get Started — ${formatINR(totalFor(advice.itemIds))}` : 'Load into Builder'} <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {advice.lighterAlt?.itemIds?.length > 0 && (
            <div className="bg-warm-50 rounded-2xl p-4 border border-warm-200">
              <h3 className="text-xs font-bold text-warm-500 uppercase tracking-wide mb-2">Lighter alternative</h3>
              <p className="text-sm text-warm-600 mb-3">{advice.lighterAlt.rationale}</p>
              <button onClick={() => loadIntoBuilder(advice.lighterAlt.itemIds)} className="text-xs font-bold text-fox-600 hover:underline">
                Load this instead ({formatINR(totalFor(advice.lighterAlt.itemIds))}) →
              </button>
            </div>
          )}
          {advice.heavierAlt?.itemIds?.length > 0 && (
            <div className="bg-warm-50 rounded-2xl p-4 border border-warm-200">
              <h3 className="text-xs font-bold text-warm-500 uppercase tracking-wide mb-2">Heavier alternative</h3>
              <p className="text-sm text-warm-600 mb-3">{advice.heavierAlt.rationale}</p>
              <button onClick={() => loadIntoBuilder(advice.heavierAlt.itemIds)} className="text-xs font-bold text-fox-600 hover:underline">
                Load this instead ({formatINR(totalFor(advice.heavierAlt.itemIds))}) →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <div className="text-center mb-8">
        <Wand2 className="w-10 h-10 text-fox-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-warm-900">AI Scope Advisor</h1>
        <p className="text-warm-500 text-sm mt-1">Question {step + 1} of {QUESTIONS.length}</p>
      </div>

      <div className="h-1.5 bg-warm-100 rounded-full mb-8">
        <div className="h-full bg-fox-500 rounded-full transition-all" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
      </div>

      <div className="bg-white rounded-3xl border border-warm-200 p-6 space-y-4">
        <h2 className="font-bold text-warm-900 text-lg">{q.label}</h2>
        <textarea
          value={answers[q.key] || ''}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={q.placeholder}
          className="input-fx min-h-[100px]"
          autoFocus
        />
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-1"><ArrowLeft size={14} /> Back</Button>
          <Button variant="primary" onClick={next} className="gap-1">
            {step === QUESTIONS.length - 1 ? 'Get Recommendation' : 'Next'} <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
