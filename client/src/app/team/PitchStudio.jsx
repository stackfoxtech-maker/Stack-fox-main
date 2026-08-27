import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Copy, MessageCircle, FileText, Lightbulb, Target, Zap, Shield, BarChart3, CheckCircle } from 'lucide-react';
import { Button, Input, Textarea, Select, Badge } from '@components/ui/Primitives';
import { businessCategories, currentSituations, mainGoals, pitchLibrary } from '@data/salesPitchLibrary';
import { toast } from 'react-hot-toast';

const sectionIcons = {
  businessUnderstanding: Lightbulb,
  commonProblems: Target,
  digitalOpportunities: Zap,
  websiteBenefits: Shield,
  managementBenefits: CheckCircle,
  marketingBenefits: BarChart3,
  seoBenefits: Search,
  aeoBenefits: FileText,
  leadGenBenefits: Target,
  recommendedFeatures: CheckCircle,
  mainPitch: MessageCircle,
  shortPitch: FileText,
  whatsappPitch: MessageCircle,
  objections: Shield,
  closingQuestions: Target,
  followUpStrategy: CheckCircle,
};

const sectionTitles = {
  businessUnderstanding: 'Understand Their Business',
  commonProblems: 'Common Problems',
  digitalOpportunities: 'Digital Opportunities',
  websiteBenefits: 'Website Benefits',
  managementBenefits: 'Daily Management Benefits',
  marketingBenefits: 'Marketing Benefits',
  seoBenefits: 'SEO Benefits — Get Discovered on Google',
  aeoBenefits: 'AEO Benefits — Prepare for the Future of Search',
  leadGenBenefits: 'Lead Generation Benefits',
  recommendedFeatures: 'Recommended Features',
  mainPitch: 'Main Sales Pitch',
  shortPitch: 'Short Pitch',
  whatsappPitch: 'WhatsApp Pitch',
  objections: 'Objections & Responses',
  closingQuestions: 'Closing Questions',
  followUpStrategy: 'Follow-Up Strategy',
};

export default function PitchStudio() {
  const [category, setCategory] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [situations, setSituations] = useState([]);
  const [goal, setGoal] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [customPitch, setCustomPitch] = useState('');

  const pitch = useMemo(() => {
    if (category && pitchLibrary[category]) {
      return pitchLibrary[category];
    }
    return null;
  }, [category]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSituation = (sit) => {
    setSituations(prev => prev.includes(sit) ? prev.filter(s => s !== sit) : [...prev, sit]);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const sectionsToRender = pitch ? [
    { key: 'businessUnderstanding', content: pitch.businessUnderstanding },
    { key: 'commonProblems', content: pitch.commonProblems, type: 'list' },
    { key: 'digitalOpportunities', content: pitch.digitalOpportunities, type: 'list' },
    { key: 'websiteBenefits', content: pitch.websiteBenefits, type: 'list' },
    { key: 'managementBenefits', content: pitch.managementBenefits, type: 'list' },
    { key: 'marketingBenefits', content: pitch.marketingBenefits, type: 'list' },
    { key: 'seoBenefits', content: pitch.seoBenefits, type: 'list' },
    { key: 'aeoBenefits', content: pitch.aeoBenefits, type: 'list' },
    { key: 'leadGenBenefits', content: pitch.leadGenBenefits, type: 'list' },
    { key: 'recommendedFeatures', content: pitch.recommendedFeatures, type: 'list' },
    { key: 'mainPitch', content: pitch.mainPitch },
    { key: 'shortPitch', content: pitch.shortPitch },
    { key: 'whatsappPitch', content: pitch.whatsappPitch },
    { key: 'objections', content: pitch.objections, type: 'objections' },
    { key: 'closingQuestions', content: pitch.closingQuestions, type: 'list' },
    { key: 'followUpStrategy', content: pitch.followUpStrategy, type: 'list' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Pitch Studio</h2>
        <p className="text-warm-500 text-sm mt-1">Select a business category to load a pre-built sales pitch</p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Business Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-fx">
              <option value="">Select category</option>
              {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
            </select>
          </div>
          <Input label="Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g., FitZone Gym" />
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Patna" />
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Main Goal</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input-fx">
              <option value="">Select goal</option>
              {mainGoals.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-warm-700 mb-2">Current Situation (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {currentSituations.map((sit) => (
              <button key={sit} onClick={() => toggleSituation(sit)} className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition', situations.includes(sit) ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200')}>
                {sit}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!pitch && category && (
        <div className="bg-warning-50 border border-warning-200 rounded-2xl p-6 text-center">
          <p className="text-warning-700 font-medium">Custom category detected</p>
          <p className="text-warning-600 text-sm mt-1">This category does not have a pre-built pitch. Please use the AI pitch generator or select a different category.</p>
        </div>
      )}

      {pitch && (
        <div className="space-y-4">
          <div className="bg-fox-50 border border-fox-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fox-500 text-white flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="font-semibold text-fox-800">Pre-Built Pitch Loaded</p>
              <p className="text-sm text-fox-600">{businessCategories.find(c => c.id === category)?.name} — {businessName || 'General'}{city ? `, ${city}` : ''}</p>
            </div>
          </div>

          {sectionsToRender.map((section) => {
            const Icon = sectionIcons[section.key];
            const isExpanded = expandedSections[section.key] !== false;

            return (
              <div key={section.key} className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
                <button onClick={() => toggleSection(section.key)} className="w-full flex items-center justify-between p-5 hover:bg-warm-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-warm-50 text-warm-600">
                      <Icon size={18} />
                    </div>
                    <h3 className="font-semibold text-warm-900">{sectionTitles[section.key]}</h3>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-warm-400" /> : <ChevronDown size={18} className="text-warm-400" />}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-warm-100">
                    <div className="pt-4">
                      {section.type === 'list' && Array.isArray(section.content) && (
                        <ul className="space-y-2">
                          {section.content.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-warm-700">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-fox-400 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      {section.type === 'objections' && typeof section.content === 'object' && (
                        <div className="space-y-3">
                          {Object.entries(section.content).map(([key, response]) => (
                            <div key={key} className="p-3 rounded-xl bg-warm-50 border border-warm-100">
                              <p className="text-sm font-medium text-warm-800 mb-1">"{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}"</p>
                              <p className="text-sm text-warm-600">{response}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {!section.type && typeof section.content === 'string' && (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-warm-700 leading-relaxed">{section.content}</p>
                          <button onClick={() => copyToClipboard(section.content)} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-fox-500 transition flex-shrink-0">
                            <Copy size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
