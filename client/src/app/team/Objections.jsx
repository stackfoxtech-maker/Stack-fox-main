import { useState } from 'react';
import { MessageSquare, Search, Copy, RotateCcw, ChevronRight } from 'lucide-react';
import { Button, Input, Badge } from '@components/ui/Primitives';
import { objectionKeys, genericObjections, businessCategories, pitchLibrary } from '@data/salesPitchLibrary';
import { toast } from 'react-hot-toast';

const topObjectionsByCategory = {
  'gym': ['expensive', 'noNeed', 'hasInstagram'],
  'restaurant': ['expensive', 'hasInstagram', 'noNeed'],
  'cafe': ['expensive', 'hasInstagram', 'noNeed'],
  'hospital': ['expensive', 'noNeed', 'hasWebsite'],
  'clinic': ['expensive', 'noNeed', 'hasInstagram'],
  'hotel': ['expensive', 'noNeed', 'hasWebsite'],
  'real-estate': ['expensive', 'noNeed', 'noCustomers'],
  'school': ['expensive', 'noNeed', 'hasInstagram'],
  'car-dealer': ['expensive', 'noNeed', 'hasWebsite'],
};

export default function Objections() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [practiceMode, setPracticeMode] = useState(false);
  const [flipped, setFlipped] = useState({});

  const getResponse = (key) => {
    if (selectedCategory && pitchLibrary[selectedCategory]?.objections?.[key]) {
      return pitchLibrary[selectedCategory].objections[key];
    }
    return genericObjections[key];
  };

  const getNextStep = (key) => {
    const nextSteps = {
      expensive: 'Follow up with ROI calculator and payment plan options.',
      noNeed: 'Share a sample website and ask: "Would this help your business grow?"',
      hasInstagram: 'Show how website + Instagram together increase conversions by 40%.',
      hasWebsite: 'Offer a free website audit to identify improvement areas.',
      noCustomers: 'Share case study of similar business that increased enquiries by 35%.',
      guaranteeRanking: 'Explain SEO process and show current rankings of similar businesses.',
      guaranteeCustomers: 'Focus on digital foundation and long-term growth strategy.',
      noSEO: 'Simplify: "SEO means Google can find you easier. We handle the tech, you run your business."',
      thinkAbout: 'Send a sample website link and follow up in 2-3 days.',
      sendWhatsApp: 'Send a WhatsApp message with website samples and pricing.',
    };
    return nextSteps[key] || 'Follow up with a personalized sample for their business.';
  };

  const filtered = objectionKeys.filter(o => {
    if (!search) return true;
    return o.label.toLowerCase().includes(search.toLowerCase()) || getResponse(o.id).toLowerCase().includes(search.toLowerCase());
  });

  const topObjections = selectedCategory && topObjectionsByCategory[selectedCategory]
    ? objectionKeys.filter(o => topObjectionsByCategory[selectedCategory].includes(o.id))
    : [];

  const objectionsToShow = practiceMode ? (topObjections.length > 0 ? topObjections : filtered) : filtered;

  const toggleFlip = (id) => {
    setFlipped(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Objection Handling</h2>
        <p className="text-warm-500 text-sm mt-1">Quick responses to common client objections</p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Filter by Category (Optional)</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="input-fx">
              <option value="">All Categories</option>
              {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search objections..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant={practiceMode ? 'primary' : 'secondary'} onClick={() => setPracticeMode(!practiceMode)}>
            {practiceMode ? 'Exit Practice Mode' : 'Practice Mode'}
          </Button>
          {practiceMode && topObjections.length > 0 && (
            <span className="text-xs text-warm-500">Showing top {topObjections.length} objections for {businessCategories.find(c => c.id === selectedCategory)?.name}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {objectionsToShow.map((obj) => {
          const response = getResponse(obj.id);
          const isFlipped = flipped[obj.id];

          if (practiceMode) {
            return (
              <div key={obj.id} onClick={() => toggleFlip(obj.id)} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-sm transition cursor-pointer min-h-[160px] flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-warning-50 text-warning-600 flex-shrink-0">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <Badge variant="warning">Objection</Badge>
                    <h3 className="font-medium text-warm-900 mt-1">"{obj.label}"</h3>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  {isFlipped ? (
                    <div className="w-full">
                      <p className="text-sm text-warm-600 leading-relaxed">{response}</p>
                      <div className="mt-3 p-3 rounded-xl bg-success-50 border border-success-100">
                        <p className="text-xs font-medium text-success-700 mb-1">Next Step:</p>
                        <p className="text-xs text-success-600">{getNextStep(obj.id)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-warm-500 italic">Click to reveal response</p>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-warm-400">{isFlipped ? 'Click to hide' : 'Click to reveal'}</span>
                  {isFlipped && (
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(response); }} className="text-xs text-fox-500 hover:text-fox-700 flex items-center gap-1">
                      <Copy size={12} /> Copy
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={obj.id} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-sm transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-xl bg-warning-50 text-warning-600 flex-shrink-0">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <Badge variant="warning">Objection</Badge>
                  <h3 className="font-medium text-warm-900 mt-1">"{obj.label}"</h3>
                </div>
              </div>
              <div className="pl-11">
                <p className="text-sm text-warm-600 leading-relaxed">{response}</p>
                <div className="mt-3 flex items-center justify-between">
                  <button onClick={() => copyToClipboard(response)} className="flex items-center gap-1 text-xs text-fox-500 hover:text-fox-700 transition">
                    <Copy size={12} /> Copy response
                  </button>
                  <div className="flex items-center gap-1 text-xs text-warm-400">
                    <span>Next:</span>
                    <ChevronRight size={12} />
                    <span className="text-warm-600">{getNextStep(obj.id)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-warm-500">No objections match your search</div>
      )}
    </div>
  );
}
