import { useState } from 'react';
import { Search, BookOpen, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { knowledgeTopics } from '@data/salesPitchLibrary';

export default function SalesKnowledge() {
  const [search, setSearch] = useState('');
  const [expandedTopic, setExpandedTopic] = useState(null);

  const filtered = knowledgeTopics.filter(topic => {
    if (!search) return true;
    const searchStr = search.toLowerCase();
    return topic.title.toLowerCase().includes(searchStr) ||
      topic.simpleExplanation.toLowerCase().includes(searchStr) ||
      topic.whatToTellClient.toLowerCase().includes(searchStr) ||
      topic.example.toLowerCase().includes(searchStr);
  });

  const toggleTopic = (id) => {
    setExpandedTopic(expandedTopic === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Knowledge Center</h2>
        <p className="text-warm-500 text-sm mt-1">Search and learn key sales concepts</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics..." className="w-full pl-9 pr-4 py-3 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
      </div>

      <div className="space-y-4">
        {filtered.map((topic) => {
          const isExpanded = expandedTopic === topic.id;
          return (
            <div key={topic.id} className="bg-white rounded-2xl border border-warm-200 overflow-hidden hover:shadow-sm transition">
              <button onClick={() => toggleTopic(topic.id)} className="w-full flex items-center justify-between p-5 hover:bg-warm-50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-fox-50 text-fox-600">
                    <BookOpen size={18} />
                  </div>
                  <h3 className="font-semibold text-warm-900">{topic.title}</h3>
                </div>
                {isExpanded ? <ChevronUp size={18} className="text-warm-400" /> : <ChevronDown size={18} className="text-warm-400" />}
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-warm-100 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">Simple Explanation</h4>
                    <p className="text-sm text-warm-700 leading-relaxed">{topic.simpleExplanation}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-fox-50 border border-fox-100">
                    <h4 className="text-xs font-semibold text-fox-700 uppercase tracking-wide mb-1">What to Tell the Client</h4>
                    <p className="text-sm text-fox-800 leading-relaxed">{topic.whatToTellClient}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">Example</h4>
                    <p className="text-sm text-warm-700 leading-relaxed">{topic.example}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Common Questions</h4>
                    <div className="space-y-2">
                      {topic.commonQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-warm-50 border border-warm-100">
                          <ExternalLink size={14} className="text-warm-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-warm-700">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-warm-500">No topics match your search</div>
      )}
    </div>
  );
}
