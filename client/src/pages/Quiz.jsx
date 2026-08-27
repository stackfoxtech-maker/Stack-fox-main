import { useState } from 'react';
import { Link } from 'react-router-dom';
import data from '@data/stackfox-data.json';

const { services, categories } = data;

const QUESTIONS = [
  { id: 'q1', q: 'What do you want to build or improve?', options: [
    { label: 'A website for my business', cat: 'Web Development' },
    { label: 'A mobile app', cat: 'Mobile App Development' },
    { label: 'Automation / AI solution', cat: 'AI & GenAI' },
    { label: 'E-commerce store', cat: 'E-Commerce' },
    { label: 'Not sure yet', cat: 'IT Consultancy' },
  ]},
  { id: 'q2', q: 'What is your budget range?', options: [
    { label: '< Rs 25K', tier: 'STARTER' },
    { label: 'Rs 25K - 1L', tier: 'GROWTH' },
    { label: 'Rs 1L - 3L', tier: 'GROWTH' },
    { label: 'Rs 3L+', tier: 'PREMIUM' },
  ]},
  { id: 'q3', q: 'How soon do you need it?', options: [
    { label: 'ASAP (rush)', mult: 1.4 },
    { label: 'Within a month', mult: 1.2 },
    { label: '1-3 months', mult: 1.0 },
    { label: 'No rush', mult: 0.9 },
  ]},
];

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  const choose = (opt) => {
    const next = [...answers, opt];
    if (step + 1 < QUESTIONS.length) {
      setAnswers(next);
      setStep(step + 1);
    } else {
      setAnswers(next);
      computeResult(next);
    }
  };

  const computeResult = (ans) => {
    const catName = ans[0]?.cat || 'Web Development';
    const tier = ans[1]?.tier || 'GROWTH';
    const category = categories.find((c) => c.name === catName) || categories[0];
    const matched = services.filter((s) => s.catId === category?.id).slice(0, 3);
    setResult({ tier, cat: category?.name, matched });
  };

  const reset = () => { setStep(0); setAnswers([]); setResult(null); };

  if (result) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-sm font-semibold text-orange-600 mb-2">Pre-purchase Quiz</p>
        <h1 className="text-3xl font-bold mb-6">Your Recommendation</h1>
        <div className="bg-[#FAFAF8] border rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-6">
            <div className="text-sm font-medium text-gray-500">Recommended tier</div>
            <div className={`text-2xl font-extrabold ${result.tier === 'PREMIUM' ? 'text-purple-600' : result.tier === 'GROWTH' ? 'text-blue-600' : 'text-orange-600'}`}>{result.tier}</div>
          </div>
          <div className="text-sm text-gray-600 mt-2">Category: {result.cat}</div>
        </div>
        {result.matched.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {result.matched.map((s) => (
              <Link key={s.id} to={`/services/${s.catId}/${s.slug || s.id}`} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
                <h3 className="font-semibold">{s.name}</h3>
                <div className="text-orange-600 font-bold mt-1">Rs {(s.price ?? 0).toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-500 mt-1">{s.est}</div>
              </Link>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Link to={`/builder?tier=${result.tier}`} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Configure and Price</Link>
          <button onClick={reset} className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">Retake Quiz</button>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[step];

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Pre-purchase Quiz · {step + 1} of {QUESTIONS.length}</p>
      <h1 className="text-3xl font-bold mb-2">{q.q}</h1>
      <div className="flex gap-2 mb-8">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="space-y-3">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => choose(opt)} className="w-full text-left bg-white border-2 border-gray-200 rounded-xl px-5 py-4 font-medium hover:border-orange-500 hover:text-orange-600 transition-colors">
            {opt.label}
          </button>
        ))}
      </div>
      <button onClick={() => setStep((p) => Math.max(0, p - 1))} className="mt-6 text-sm text-gray-500 hover:underline">Back</button>
    </div>
  );
}