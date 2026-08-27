import { useState } from 'react';
import { FileText, PenTool, CheckSquare, Send } from 'lucide-react';

const mockContract = {
  title: 'Service Agreement — StackFox Technologies',
  date: 'August 20, 2026',
  clauses: [
    'This Agreement is entered into between StackFox Technologies ("Provider") and the undersigned Client.',
    'The Provider agrees to deliver the services described in the attached scope of work within the agreed timeline.',
    'Payment terms: 50% upfront, 50% upon completion. Late payments incur a 2% monthly fee.',
    'Either party may terminate with 30 days written notice. Work completed up to termination date will be billed.',
    'All intellectual property created during the engagement transfers to the Client upon full payment.',
    'Confidential information shared during the project shall not be disclosed to third parties.',
  ],
};

export default function ESign() {
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState({ terms: false, accuracy: false });
  const [signed, setSigned] = useState(false);

  const canSign = signature.trim() && agreed.terms && agreed.accuracy;

  const handleSign = () => { if (canSign) setSigned(true); };

  if (signed) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="text-green-600" size={28} />
          </div>
          <h2 className="text-2xl font-bold text-warm-900 mb-2">Document Signed</h2>
          <p className="text-warm-500 mb-1">Signed by: <span className="font-medium text-warm-700">{signature}</span></p>
          <p className="text-warm-500 text-sm">A copy has been sent to your email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-warm-900 flex items-center gap-3">
          <FileText className="text-fox-500" /> E-Signature
        </h1>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-warm-900">{mockContract.title}</h2>
            <span className="text-sm text-warm-500">{mockContract.date}</span>
          </div>
          <div className="bg-warm-50 rounded-xl p-5 space-y-3 max-h-72 overflow-y-auto text-sm text-warm-700 leading-relaxed">
            {mockContract.clauses.map((c, i) => (
              <p key={i}><span className="font-semibold text-warm-900">{i + 1}.</span> {c}</p>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <h2 className="text-lg font-semibold text-warm-900 mb-4 flex items-center gap-2">
            <PenTool size={18} className="text-fox-500" /> Your Signature
          </h2>
          <input
            value={signature}
            onChange={e => setSignature(e.target.value)}
            placeholder="Type your full legal name"
            className="w-full border-b-2 border-warm-300 focus:border-fox-500 outline-none text-2xl py-3 font-serif text-warm-900 bg-transparent transition"
          />
          {signature && (
            <p className="mt-3 text-sm text-warm-500">Preview: <span className="font-serif text-xl text-warm-900 italic">{signature}</span></p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6 space-y-3">
          {[
            { key: 'terms', label: 'I agree to the terms and conditions outlined in this document.' },
            { key: 'accuracy', label: 'I confirm that the information provided is accurate and complete.' },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed[item.key]}
                onChange={() => setAgreed({ ...agreed, [item.key]: !agreed[item.key] })}
                className="mt-1 accent-fox-500"
              />
              <span className="text-sm text-warm-700">{item.label}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleSign}
          disabled={!canSign}
          className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition ${canSign ? 'bg-fox-500 text-white hover:bg-fox-600' : 'bg-warm-200 text-warm-400 cursor-not-allowed'}`}
        >
          <Send size={18} /> Sign & Submit
        </button>
      </div>
    </div>
  );
}
