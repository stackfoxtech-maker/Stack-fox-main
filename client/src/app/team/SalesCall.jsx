import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle, MessageCircle, Target, Zap, Shield, Phone, Timer, Save, ArrowRight, Sparkles } from 'lucide-react';
import { Button, Badge } from '@components/ui/Primitives';
import { cn } from '@lib/utils';
import { businessCategories, getPitch } from '@data/salesPitchLibrary';
import { toast } from 'react-hot-toast';

const baseSteps = [
  {
    id: 'intro',
    title: 'Step 1: Introduction',
    icon: Phone,
    description: 'Build rapport and understand how the client currently operates.',
    getQuestions: (pitch) => pitch ? [
      'How do most customers currently find you?',
      'Do customers search for you online?',
      'Where do you receive most enquiries?',
      'How do you currently handle customer enquiries?',
      'What is your main challenge in getting new customers?',
      pitch.categoryName + ' specific: ' + pitch.commonProblems[0],
    ] : [],
  },
  {
    id: 'discover',
    title: 'Step 2: Discover Problems',
    icon: Target,
    description: 'Identify the key pain points and challenges the business is facing.',
    getProblems: (pitch) => pitch ? pitch.commonProblems.slice(0, 4) : [],
  },
  {
    id: 'solution',
    title: 'Step 3: Show Relevant Solution',
    icon: Zap,
    description: 'Present the category-specific benefits and features that solve their problems.',
    getPoints: (pitch) => pitch ? pitch.websiteBenefits.slice(0, 4) : [],
  },
  {
    id: 'objection',
    title: 'Step 4: Handle Objections',
    icon: Shield,
    description: 'Address common concerns with honest, helpful responses.',
    getObjections: (pitch) => {
      if (!pitch) return [];
      const topKeys = ['expensive', 'noNeed', 'hasInstagram', 'hasWebsite', 'noCustomers'];
      return topKeys.map(key => ({
        question: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        response: pitch.objections[key] || 'I understand your concern. Let me address that...',
      }));
    },
  },
  {
    id: 'closing',
    title: 'Step 5: Closing',
    icon: CheckCircle,
    description: 'Guide the conversation towards the next step.',
    getQuestions: (pitch) => pitch ? pitch.closingQuestions.slice(0, 4) : [],
  },
];

const nextActions = [
  { label: 'Send Proposal', icon: FileText, path: '/app/team/sales/proposals', color: 'bg-fox-500 hover:bg-fox-600 text-white' },
  { label: 'Schedule Follow-up', icon: Calendar, path: '/app/team/sales/follow-ups', color: 'bg-warning-500 hover:bg-warning-600 text-white' },
  { label: 'Share Pitch', icon: MessageCircle, path: '/app/team/sales/pitch-studio', color: 'bg-info-500 hover:bg-info-600 text-white' },
  { label: 'Add Lead', icon: Users, path: '/app/team/sales/leads', color: 'bg-success-500 hover:bg-success-600 text-white' },
];

export default function SalesCall() {
  const [category, setCategory] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [notes, setNotes] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  const [seconds, setSeconds] = useState(0);
  const [showNextActions, setShowNextActions] = useState(false);

  const pitch = useMemo(() => {
    if (category) return getPitch(category);
    return null;
  }, [category]);

  const steps = useMemo(() => baseSteps.map(step => ({
    ...step,
    questions: step.getQuestions?.(pitch) || [],
    problems: step.getProblems?.(pitch) || [],
    points: step.getPoints?.(pitch) || [],
    objections: step.getObjections?.(pitch) || [],
  })), [pitch]);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const allCompleted = steps.every(s => completed.includes(s.id));

  useEffect(() => {
    const saved = localStorage.getItem('salesCallNotes');
    if (saved) setNotes(saved);
  }, []);

  useEffect(() => {
    if (notes !== undefined) {
      localStorage.setItem('salesCallNotes', notes);
    }
  }, [notes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const markComplete = () => {
    setCompleted([...completed, step.id]);
    toast.success('Step completed!');
  };

  const toggleItem = (idx) => {
    setCheckedItems(prev => ({ ...prev, [`${currentStep}-${idx}`]: !prev[`${currentStep}-${idx}`] }));
  };

  const resetCall = () => {
    setCurrentStep(0);
    setCompleted([]);
    setCheckedItems({});
    setSeconds(0);
    setShowNextActions(false);
    setNotes('');
    localStorage.removeItem('salesCallNotes');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Sales Call Mode</h2>
        <p className="text-warm-500 text-sm mt-1">Step-by-step guided sales call assistant with category-specific scripts</p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Select Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-fx">
              <option value="">Select category</option>
              {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Call Duration</label>
            <div className="flex items-center gap-2 bg-warm-50 border border-warm-200 rounded-xl px-4 py-2.5">
              <Timer size={16} className="text-warm-400" />
              <span className="text-sm font-mono text-warm-700">{formatTime(seconds)}</span>
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={resetCall} className="w-full"><RotateCcw size={16} /> Reset Call</Button>
          </div>
        </div>
      </div>

      {!category ? (
        <div className="bg-warning-50 border border-warning-200 rounded-2xl p-6 text-center">
          <p className="text-warning-700 font-medium">Select a category to load a category-specific sales script</p>
          <p className="text-warning-600 text-sm mt-1">The script will adapt to the selected business type with relevant questions, objections, and closing techniques.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-warm-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-fox-50 text-fox-600">
                  <step.icon size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-warm-900">{step.title}</h3>
                  <p className="text-sm text-warm-500">{step.description}</p>
                </div>
              </div>
              {completed.includes(step.id) && <Badge variant="success">Completed</Badge>}
            </div>

            <div className="w-full bg-warm-100 rounded-full h-2 mb-6">
              <div className="bg-fox-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            <div className="space-y-4">
              {step.questions && step.questions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warm-700 mb-2">Suggested Questions:</p>
                  {step.questions.map((q, idx) => (
                    <div key={idx} onClick={() => toggleItem(idx)} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-50 border-success-200' : 'bg-warm-50 border-warm-100 hover:border-warm-200')}>
                      <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-500 border-success-500' : 'border-warm-300')}>
                        {checkedItems[`${currentStep}-${idx}`] && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <p className={cn('text-sm', checkedItems[`${currentStep}-${idx}`] ? 'text-success-700 line-through' : 'text-warm-700')}>{q}</p>
                    </div>
                  ))}
                </div>
              )}

              {step.problems && step.problems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warm-700 mb-2">Common Problems to Identify:</p>
                  {step.problems.map((problem, idx) => (
                    <div key={idx} onClick={() => toggleItem(idx)} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-50 border-success-200' : 'bg-warm-50 border-warm-100 hover:border-warm-200')}>
                      <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-500 border-success-500' : 'border-warning-400')}>
                        {checkedItems[`${currentStep}-${idx}`] ? <CheckCircle size={12} className="text-white" /> : <div className="w-2 h-2 rounded-full bg-warning-500" />}
                      </div>
                      <p className={cn('text-sm', checkedItems[`${currentStep}-${idx}`] ? 'text-success-700 line-through' : 'text-warm-700')}>{problem}</p>
                    </div>
                  ))}
                </div>
              )}

              {step.points && step.points.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warm-700 mb-2">Key Points to Cover:</p>
                  {step.points.map((point, idx) => (
                    <div key={idx} onClick={() => toggleItem(idx)} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-50 border-success-200' : 'bg-fox-50 border-fox-100 hover:border-fox-200')}>
                      <div className={cn('w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-500 text-white' : 'bg-fox-500 text-white')}>
                        {checkedItems[`${currentStep}-${idx}`] ? <CheckCircle size={12} /> : idx + 1}
                      </div>
                      <p className={cn('text-sm', checkedItems[`${currentStep}-${idx}`] ? 'text-success-700 line-through' : 'text-warm-700')}>{point}</p>
                    </div>
                  ))}
                </div>
              )}

              {step.objections && step.objections.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-warm-700 mb-2">Common Objections & Responses:</p>
                  {step.objections.map((obj, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-warning-50 border border-warning-100">
                      <p className="text-sm font-medium text-warning-800 mb-1">"{obj.question}"</p>
                      <p className="text-sm text-warning-700">{obj.response}</p>
                    </div>
                  ))}
                </div>
              )}

              {step.closingQuestions && step.closingQuestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warm-700 mb-2">Suggested Closing Questions:</p>
                  {step.closingQuestions.map((q, idx) => (
                    <div key={idx} onClick={() => toggleItem(idx)} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition', checkedItems[`${currentStep}-${idx}`] ? 'bg-success-50 border-success-200' : 'bg-success-50 border-success-100 hover:border-success-200')}>
                      <CheckCircle size={16} className={cn('flex-shrink-0 mt-0.5', checkedItems[`${currentStep}-${idx}`] ? 'text-success-500' : 'text-success-400')} />
                      <p className={cn('text-sm', checkedItems[`${currentStep}-${idx}`] ? 'text-success-700 line-through' : 'text-warm-700')}>{q}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-warm-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-warm-900">Call Notes</h3>
              <div className="flex items-center gap-1 text-xs text-warm-500">
                <Save size={12} />
                <span>Auto-saved</span>
              </div>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Take notes during the call..." className="w-full border border-warm-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none" rows={4} />
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}><ChevronLeft size={16} /> Previous</Button>
              <div className="flex gap-2">
                {!completed.includes(step.id) && <Button onClick={markComplete}>Mark Complete</Button>}
                <Button onClick={() => {
                  if (currentStep === steps.length - 1) {
                    setShowNextActions(true);
                  }
                  setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
                }} disabled={currentStep === steps.length - 1}>
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>

          {showNextActions && allCompleted && (
            <div className="bg-success-50 border border-success-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-success-500 text-white">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-success-800">Call Complete! Recommended Next Actions</h3>
                  <p className="text-sm text-success-600">Based on your call, here are the suggested next steps:</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {nextActions.map(action => (
                  <NavLink key={action.label} to={action.path} className={cn('flex flex-col items-center gap-2 p-4 rounded-xl transition', action.color)}>
                    <action.icon size={20} />
                    <span className="text-xs font-medium text-center">{action.label}</span>
                  </NavLink>
                ))}
              </div>
              {pitch && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-success-100">
                  <p className="text-sm font-medium text-success-700 mb-1">Suggested Pitch to Use Next:</p>
                  <p className="text-sm text-warm-700">{pitch.shortPitch}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
