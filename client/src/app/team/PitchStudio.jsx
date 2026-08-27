import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Copy, MessageCircle, FileText, Lightbulb, Target, Zap, Shield, BarChart3, CheckCircle, TrendingUp, Sparkles, Users, Printer, Mail, Phone as PhoneIcon, Wand2, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { Button, Input, Textarea, Select, Badge } from '@components/ui/Primitives';
import { businessCategories, currentSituations, mainGoals, pitchLibrary, getPitch } from '@data/salesPitchLibrary';
import { toast } from 'react-hot-toast';

const categoryKeywords = {
  gym: ['gym', 'fitness', 'workout', 'fitness center', 'bodybuilding', 'crossfit'],
  restaurant: ['restaurant', 'food', 'kitchen', 'dining', 'mess', 'dhaba'],
  cafe: ['cafe', 'coffee', 'cafeteria', 'bistro', 'tea'],
  hospital: ['hospital', 'medical', 'healthcare', 'medicare', 'nursing'],
  clinic: ['clinic', 'doctor', 'medical', 'physician', 'polyclinic'],
  hotel: ['hotel', 'resort', 'stay', 'accommodation', 'lodge', 'motel'],
  'real-estate': ['real estate', 'property', 'builder', 'construction', 'realtor', 'properties'],
  dental: ['dental', 'dentist', 'teeth', 'orthodontic'],
  'fast-food': ['fast food', 'burger', 'pizza', 'quick bite', 'snacks'],
  salon: ['salon', 'hair', 'beauty parlour', 'spa', 'massage'],
  school: ['school', 'academy', 'institute', 'coaching', 'tuition'],
  'car-dealer': ['car dealer', 'showroom', 'automobile', 'vehicle'],
  photographer: ['photographer', 'photo', 'shoot', 'camera'],
  'packers-movers': ['packers', 'movers', 'shifting', 'relocation'],
  grocery: ['grocery', 'kirana', 'supermarket', 'provision'],
  clothing: ['clothing', 'fashion', 'apparel', 'boutique', 'garment'],
  ecommerce: ['ecommerce', 'online store', 'shop', 'marketplace'],
};

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
  roiProjection: TrendingUp,
  quickWin: Sparkles,
  caseStudy: Users,
  competitorAdvantage: Zap,
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
  roiProjection: 'ROI Projection',
  quickWin: 'Quick Win',
  caseStudy: 'Case Study',
  competitorAdvantage: 'Competitor Advantage',
};

const personaOptions = {
  size: [
    { value: '', label: 'Business size' },
    { value: 'small', label: 'Small (1-5 people)' },
    { value: 'medium', label: 'Medium (6-20 people)' },
    { value: 'large', label: 'Large (20+ people)' },
  ],
  maturity: [
    { value: '', label: 'Current digital presence' },
    { value: 'none', label: 'No website / No presence' },
    { value: 'basic', label: 'Basic website / Social only' },
    { value: 'advanced', label: 'Has website, needs upgrade' },
  ],
  goal: [
    { value: '', label: 'Primary goal' },
    { value: 'leads', label: 'More leads / enquiries' },
    { value: 'sales', label: 'More sales / bookings' },
    { value: 'brand', label: 'Better brand image' },
    { value: 'management', label: 'Better management' },
  ],
};

const pitchModes = [
  { value: 'standard', label: 'Standard', icon: FileText },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'call', label: 'Call Script', icon: PhoneIcon },
  { value: 'email', label: 'Email Draft', icon: Mail },
  { value: 'print', label: 'Print / PDF', icon: Printer },
];

function buildEmailDraft(pitch) {
  const subject = 'Website proposal for ' + (pitch.businessName || pitch.categoryName);
  const body = 'Hi,\n\n' + pitch.mainPitch + '\n\n' + pitch.shortPitch + '\n\nKey benefits:\n' + pitch.websiteBenefits.slice(0, 3).join('\n- ') + '\n\nNext step: ' + pitch.closingQuestions[0] + '\n\nBest regards';
  return { subject, body };
}

function buildCallScript(pitch) {
  return [
    'Opening: ' + pitch.mainPitch,
    'Problem check: ' + pitch.commonProblems[0],
    'Solution: ' + pitch.websiteBenefits[0],
    'Objection prep: ' + pitch.objections.expensive,
    'Close: ' + pitch.closingQuestions[0],
  ];
}

function formatWhatsApp(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '*$1*').replace(/\n/g, '\n');
}

export default function PitchStudio() {
  const [category, setCategory] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [situations, setSituations] = useState([]);
  const [goal, setGoal] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [customPitch, setCustomPitch] = useState('');
  const [pitchMode, setPitchMode] = useState('standard');
  const [persona, setPersona] = useState({ size: '', maturity: '', goal: '' });
  const [copiedSection, setCopiedSection] = useState('');
  const [callStep, setCallStep] = useState(0);
  const [feedback, setFeedback] = useState({});

  const pitch = useMemo(() => {
    if (category) {
      return getPitch(category, { name: businessName, city, situations, goal, persona });
    }
    return null;
  }, [category, businessName, city, situations, goal, persona]);

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

  const copyFullPitch = () => {
    if (!pitch) return;
    const fullText = [
      pitch.mainPitch,
      '',
      'SHORT PITCH:',
      pitch.shortPitch,
      '',
      'WHATSAPP PITCH:',
      pitch.whatsappPitch,
      '',
      'KEY BENEFITS:',
      pitch.websiteBenefits.join('\n- '),
      '',
      'RECOMMENDED FEATURES:',
      pitch.recommendedFeatures.join('\n- '),
      '',
      'ROI:',
      pitch.roiProjection,
      '',
      'QUICK WIN:',
      pitch.quickWin,
    ].join('\n');
    copyToClipboard(fullText);
  };

  const printPitch = () => {
    window.print();
  };

  const shareWhatsApp = () => {
    if (!pitch) return;
    const text = encodeURIComponent(pitch.whatsappPitch + '\n\n' + pitch.shortPitch);
    window.open('https://wa.me/?text=' + text, '_blank');
  };

  const detectCategory = (name) => {
    const lower = name.toLowerCase();
    for (const [catId, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => lower.includes(k))) {
        return catId;
      }
    }
    return '';
  };

  const handleBusinessNameChange = (value) => {
    setBusinessName(value);
    if (!category && value) {
      const detected = detectCategory(value);
      if (detected) setCategory(detected);
    }
  };

  const expandAll = () => {
    if (!pitch) return;
    const all = {};
    sectionsToRender.forEach(s => { all[s.key] = true; });
    setExpandedSections(all);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const handleFeedback = (sectionKey, type) => {
    setFeedback(prev => ({ ...prev, [sectionKey]: type }));
    toast.success('Feedback saved');
  };

  const callScript = pitch ? buildCallScript(pitch) : [];
  const emailDraft = pitch ? buildEmailDraft(pitch) : null;
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
    { key: 'roiProjection', content: pitch.roiProjection },
    { key: 'quickWin', content: pitch.quickWin },
    { key: 'caseStudy', content: pitch.caseStudy },
    { key: 'competitorAdvantage', content: pitch.competitorAdvantage },
  ] : [];

  const getModeContent = () => {
    if (!pitch) return null;
    switch (pitchMode) {
      case 'whatsapp':
        return { title: 'WhatsApp Ready Pitch', content: formatWhatsApp(pitch.whatsappPitch + '\n\n' + pitch.shortPitch) };
      case 'call':
        return { title: 'Call Script', content: callScript };
      case 'email':
        return { title: 'Email Draft', content: emailDraft };
      default:
        return null;
    }
  };

  const modeContent = getModeContent();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Pitch Studio</h2>
        <p className="text-warm-500 text-sm mt-1">Generate a personalized sales pitch for any business category</p>
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
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Business Name</label>
            <Input value={businessName} onChange={(e) => handleBusinessNameChange(e.target.value)} placeholder="e.g., FitZone Gym" />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">City</label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Patna" />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Main Goal</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input-fx">
              <option value="">Select goal</option>
              {mainGoals.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-warm-700 mb-2">Client Persona</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={persona.size} onChange={(e) => setPersona({ ...persona, size: e.target.value })} className="input-fx">
              {personaOptions.size.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={persona.maturity} onChange={(e) => setPersona({ ...persona, maturity: e.target.value })} className="input-fx">
              {personaOptions.maturity.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={persona.goal} onChange={(e) => setPersona({ ...persona, goal: e.target.value })} className="input-fx">
              {personaOptions.goal.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

        {pitch && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-warm-100">
            <span className="text-xs font-medium text-warm-500 mr-2">Pitch Mode:</span>
            {pitchModes.map(mode => (
              <button key={mode.value} onClick={() => setPitchMode(mode.value)} className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition', pitchMode === mode.value ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200')}>
                <mode.icon size={14} /> {mode.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={expandAll} className="text-xs text-fox-500 hover:text-fox-700 font-medium">Expand All</button>
            <button onClick={collapseAll} className="text-xs text-fox-500 hover:text-fox-700 font-medium">Collapse All</button>
            <button onClick={copyFullPitch} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-fox-50 text-fox-600 hover:bg-fox-100 transition">
              <Copy size={14} /> Copy Full Pitch
            </button>
            <button onClick={shareWhatsApp} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success-50 text-success-600 hover:bg-success-100 transition">
              <MessageCircle size={14} /> Share on WhatsApp
            </button>
            <button onClick={printPitch} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-warm-100 text-warm-600 hover:bg-warm-200 transition">
              <Printer size={14} /> Print
            </button>
          </div>
        )}
      </div>

      {modeContent && pitchMode !== 'standard' && (
        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <h3 className="font-semibold text-warm-900 mb-3">{modeContent.title}</h3>
          <div className="bg-warm-50 rounded-xl p-4">
            {pitchMode === 'call' ? (
              <div className="space-y-3">
                {modeContent.content.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 h-6 rounded-full bg-fox-500 text-white text-xs flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                    <p className="text-sm text-warm-700">{line}</p>
                  </div>
                ))}
              </div>
            ) : pitchMode === 'email' ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-warm-500 uppercase tracking-wide">Subject: {modeContent.content.subject}</p>
                <p className="text-sm text-warm-700 whitespace-pre-line">{modeContent.content.body}</p>
              </div>
            ) : (
              <p className="text-sm text-warm-700 whitespace-pre-line">{modeContent.content}</p>
            )}
          </div>
        </div>
      )}

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
              <p className="font-semibold text-fox-800">Personalized Pitch Loaded</p>
              <p className="text-sm text-fox-600">{pitch.categoryName} — {pitch.businessName || 'General'}{pitch.city ? `, ${pitch.city}` : ''}{pitch.selectedGoal ? ` | Goal: ${pitch.selectedGoal}` : ''}</p>
            </div>
          </div>

          {pitchMode === 'standard' && (
            <>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="font-semibold text-warm-900 mb-4">ROI Calculator</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-warm-700 mb-1.5">Current Monthly Customers</label>
                    <Input type="number" placeholder="e.g., 50" id="roi-customers" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-700 mb-1.5">Avg. Value per Customer (Rs.)</label>
                    <Input type="number" placeholder="e.g., 2000" id="roi-value" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-700 mb-1.5">Expected Increase (%)</label>
                    <Input type="number" placeholder="e.g., 30" id="roi-increase" />
                  </div>
                </div>
                <div className="mt-4 p-4 bg-success-50 border border-success-100 rounded-xl">
                  <p className="text-sm text-success-700 font-medium">Projected Monthly Revenue Increase</p>
                  <p className="text-2xl font-bold text-success-800 mt-1" id="roi-result">Rs. 0</p>
                </div>
              </div>

              {sectionsToRender.map((section) => {
                const Icon = sectionIcons[section.key];
                const isExpanded = expandedSections[section.key] !== false;
                const isList = section.type === 'list';
                const isObjections = section.type === 'objections';
                const sectionFeedback = feedback[section.key];

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
                          {isList && Array.isArray(section.content) && (
                            <ul className="space-y-2">
                              {section.content.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-warm-700">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-fox-400 flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                          {isObjections && typeof section.content === 'object' && (
                            <div className="space-y-3">
                              {Object.entries(section.content).map(([key, response]) => (
                                <div key={key} className="p-3 rounded-xl bg-warm-50 border border-warm-100">
                                  <p className="text-sm font-medium text-warm-800 mb-1">"{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}"</p>
                                  <p className="text-sm text-warm-600">{response}</p>
                                  <button onClick={() => copyToClipboard(response)} className="mt-2 flex items-center gap-1 text-xs text-fox-500 hover:text-fox-700 transition">
                                    <Copy size={12} /> Copy response
                                  </button>
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

                          {section.key !== 'objections' && section.key !== 'roiProjection' && section.key !== 'quickWin' && (
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-xs text-warm-500">Was this helpful?</span>
                              <button onClick={() => handleFeedback(section.key, 'yes')} className={cn('text-xs px-2 py-1 rounded-lg transition', sectionFeedback === 'yes' ? 'bg-success-100 text-success-700' : 'bg-warm-100 text-warm-600 hover:bg-warm-200')}>Yes</button>
                              <button onClick={() => handleFeedback(section.key, 'no')} className={cn('text-xs px-2 py-1 rounded-lg transition', sectionFeedback === 'no' ? 'bg-danger-100 text-danger-700' : 'bg-warm-100 text-warm-600 hover:bg-warm-200')}>No</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
