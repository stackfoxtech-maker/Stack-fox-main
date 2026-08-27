import { useState } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle, MessageCircle, Target, Zap, Shield, Phone } from 'lucide-react';
import { Button, Badge } from '@components/ui/Primitives';
import { cn } from '@lib/utils';

const steps = [
  {
    id: 'intro',
    title: 'Step 1: Introduction',
    icon: Phone,
    description: 'Build rapport and understand how the client currently operates.',
    questions: [
      'How do most customers currently find you?',
      'Do customers search for you online?',
      'Where do you receive most enquiries?',
      'How do you currently handle customer enquiries?',
      'What is your main challenge in getting new customers?',
    ],
  },
  {
    id: 'discover',
    title: 'Step 2: Discover Problems',
    icon: Target,
    description: 'Identify the key pain points and challenges the business is facing.',
    problems: [
      'Not enough leads or enquiries',
      'Manual work for bookings and enquiries',
      'No online presence or weak digital presence',
      'Low visibility on Google',
      'No proper website or an outdated website',
      'Poor enquiry management system',
      'Depends only on Instagram or word of mouth',
    ],
  },
  {
    id: 'solution',
    title: 'Step 3: Show Relevant Solution',
    icon: Zap,
    description: 'Present the category-specific benefits and features that solve their problems.',
    points: [
      'Professional website that builds trust',
      'Online enquiry and booking system',
      'Google visibility through SEO',
      'Centralized customer management',
      'Marketing campaign support',
      'Mobile-friendly experience',
    ],
  },
  {
    id: 'objection',
    title: 'Step 4: Handle Objections',
    icon: Shield,
    description: 'Address common concerns with honest, helpful responses.',
    objections: [
      { question: "It's expensive", response: "I understand. Instead of looking only at the initial cost, it can help to evaluate what the digital system is designed to do for your business—such as improving credibility, making enquiries easier to capture and supporting your marketing." },
      { question: "I don't need a website", response: "You may not need a website just for having one. The real question is whether your business could benefit from a stronger digital presence, clearer information, easier enquiries and a central destination for your marketing." },
      { question: "I already have Instagram", response: "That's great. We are not replacing Instagram. Your website can work together with Instagram. When someone becomes interested through a post or advertisement, they can visit your professional website and take the next step." },
      { question: "Can you guarantee customers?", response: "No responsible agency can guarantee a specific number of customers because results depend on many factors. What we can build is a strong digital foundation designed to improve your ability to get discovered, explain your services clearly and convert interested visitors into enquiries." },
      { question: "Can you guarantee Google ranking?", response: "No responsible agency can guarantee a specific Google ranking because search results depend on many factors. What we can do is build a strong SEO foundation that improves your opportunity to be discovered for relevant searches." },
    ],
  },
  {
    id: 'closing',
    title: 'Step 5: Closing',
    icon: CheckCircle,
    description: 'Guide the conversation towards the next step.',
    questions: [
      'Would you like me to show you what your business could look like online?',
      'Which area would you like to improve first—visibility, enquiries or business management?',
      'Would you like me to prepare a custom proposal for your business?',
      'When would be a good time for a follow-up call?',
    ],
  },
];

export default function SalesCall() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [notes, setNotes] = useState('');
  const [checkedQuestions, setCheckedQuestions] = useState({});

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const markComplete = () => {
    setCompleted([...completed, step.id]);
  };

  const toggleQuestion = (idx) => {
    setCheckedQuestions(prev => ({ ...prev, [`${currentStep}-${idx}`]: !prev[`${currentStep}-${idx}`] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Sales Call Mode</h2>
        <p className="text-warm-500 text-sm mt-1">Step-by-step guided sales call assistant</p>
      </div>

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
          {step.questions && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-warm-700 mb-2">Suggested Questions:</p>
              {step.questions.map((q, idx) => (
                <div key={idx} onClick={() => toggleQuestion(idx)} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition', checkedQuestions[`${currentStep}-${idx}`] ? 'bg-success-50 border-success-200' : 'bg-warm-50 border-warm-100 hover:border-warm-200')}>
                  <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition', checkedQuestions[`${currentStep}-${idx}`] ? 'bg-success-500 border-success-500' : 'border-warm-300')}>
                    {checkedQuestions[`${currentStep}-${idx}`] && <CheckCircle size={12} className="text-white" />}
                  </div>
                  <p className={cn('text-sm', checkedQuestions[`${currentStep}-${idx}`] ? 'text-success-700 line-through' : 'text-warm-700')}>{q}</p>
                </div>
              ))}
            </div>
          )}

          {step.problems && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-warm-700 mb-2">Common Problems to Identify:</p>
              {step.problems.map((problem, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-warm-50 border border-warm-100">
                  <div className="w-5 h-5 rounded-md border-2 border-warning-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-warning-500" />
                  </div>
                  <p className="text-sm text-warm-700">{problem}</p>
                </div>
              ))}
            </div>
          )}

          {step.points && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-warm-700 mb-2">Key Points to Cover:</p>
              {step.points.map((point, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-fox-50 border border-fox-100">
                  <div className="w-5 h-5 rounded-md bg-fox-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">{idx + 1}</div>
                  <p className="text-sm text-warm-700">{point}</p>
                </div>
              ))}
            </div>
          )}

          {step.objections && (
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

          {step.closingQuestions && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-warm-700 mb-2">Suggested Closing Questions:</p>
              {step.closingQuestions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-success-50 border border-success-100">
                  <CheckCircle size={16} className="text-success-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warm-700">{q}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-warm-100">
          <label className="block text-sm font-medium text-warm-700 mb-1.5">Call Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Take notes during the call..." className="w-full border border-warm-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none" rows={3} />
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}><ChevronLeft size={16} /> Previous</Button>
            <div className="flex gap-2">
              {!completed.includes(step.id) && <Button onClick={markComplete}>Mark Complete</Button>}
              <Button onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))} disabled={currentStep === steps.length - 1}>Next <ChevronRight size={16} /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
