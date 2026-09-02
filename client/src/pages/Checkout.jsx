import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, CreditCard, ArrowRight, ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { TIER_LABELS } from '@lib/estimate';
import { Spinner, Button } from '@components/ui/Primitives';
import api from '@lib/api';
import { loadRazorpay } from '@lib/razorpay';
import toast from 'react-hot-toast';
import InvoicePreview from '@components/checkout/InvoicePreview';
import ContractSigning from '@components/checkout/ContractSigning';

const STEP_NAMES = {
  STARTER: ['Confirm Package', 'Invoice', 'Your Details', 'Contract', 'Pay'],
  GROWTH: ['Review Scope', 'Account', 'Project Setup', 'Payment Terms', 'Invoice', 'Contract', 'Docs & Pay'],
  PREMIUM: ['Review Scope', 'Organisation', 'Engagement', 'Payment Terms', 'Invoice', 'Contract', 'Docs & E-Sign', 'Pay', 'Confirm'],
};

export default function Checkout() {
  usePageTitle('Checkout');
  const { quoteId } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [paying, setPaying] = useState(false);
  const [account, setAccount] = useState({ name: '', phone: '', email: '', orgName: '', gstin: '' });
  const [project, setProject] = useState({ projectName: '', startDate: '', commsPreference: 'Email' });
  const [paymentMode, setPaymentMode] = useState('MILESTONE');
  const [engagementModel, setEngagementModel] = useState('FPM');
  const [docsAccepted, setDocsAccepted] = useState(true);

  useEffect(() => {
    api.get(`/quotes/${quoteId}`)
      .then((r) => setQuote(r.data.data))
      .catch(() => toast.error('Quote not found or expired.'))
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!quote) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <p className="text-warm-600 mb-4">This quote couldn't be found.</p>
        <Link to="/builder" className="text-fox-500 font-semibold">Back to Builder →</Link>
      </div>
    );
  }
  if (quote.status === 'paid') {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-warm-900 mb-2">Already paid</h1>
        <p className="text-warm-600 mb-6">Quote {quote.quoteNumber} was already confirmed.</p>
        <Link to="/app/client/quotes" className="text-fox-500 font-semibold">View my quotes →</Link>
      </div>
    );
  }

  const tier = quote.tier || 'GROWTH';
  const steps = STEP_NAMES[tier];
  const range = quote.estimateRange || {};
  const isLastStep = step === steps.length - 1;

  const saveDetails = async () => {
    try {
      await api.patch(`/quotes/${quoteId}`, {
        tier,
        checkoutDetails: { account, project, paymentMode, engagementModel, docsAccepted },
      });
    } catch {
      // Non-fatal — the wizard can still proceed locally; payment is authoritative.
    }
  };

  const next = async () => {
    if (steps[step] === 'Your Details' || steps[step] === 'Account' || steps[step] === 'Organisation') {
      if (!account.name || !account.phone || !account.email) {
        toast.error('Name, phone and email are required.');
        return;
      }
    }
    await saveDetails();
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const effectivePaymentMode = tier === 'STARTER' ? 'FULL' : paymentMode;
  const payAmount = effectivePaymentMode === 'UPFRONT' ? Math.round(quote.total * 0.95)
    : effectivePaymentMode === 'MILESTONE' ? Math.round(quote.total * 0.3)
    : quote.total;

  const handlePay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post(`/quotes/${quoteId}/pay`, { paymentMode: effectivePaymentMode });
      const order = data.data;

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'StackFox',
        description: `Payment for ${order.quoteNumber}`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            const verifyRes = await api.post(`/quotes/${quoteId}/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setQuote(verifyRes.data.data);
            toast.success('Payment successful!');
            if (tier === 'PREMIUM') setStep(steps.length - 1);
            else navigate('/app/client/quotes');
          } catch {
            toast.error('Payment verification failed.');
          }
        },
        prefill: { name: account.name, email: account.email, contact: account.phone },
        theme: { color: '#FF4D00' },
        modal: { ondismiss: () => toast('Payment cancelled — your quote is unchanged.') },
      };

      try {
        await loadRazorpay();
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp) => {
          toast.error(resp.error?.description || 'Payment failed. Try another method or retry.');
        });
        rzp.open();
      } catch {
        toast.error('Could not load the payment gateway. Check your connection and retry.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start payment.');
    }
    setPaying(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <span className="text-xs font-bold text-fox-500 uppercase tracking-widest">{TIER_LABELS[tier]} Checkout</span>
        <h1 className="text-2xl font-bold text-warm-900 mt-1">{quote.quoteNumber}</h1>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {steps.map((name, i) => (
          <div key={name} className="flex-1 text-center">
            <div className={`h-1.5 rounded-full mb-2 ${i <= step ? 'bg-fox-500' : 'bg-warm-200'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${i === step ? 'text-fox-600' : 'text-warm-400'}`}>{name}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-warm-200 p-6 md:p-8 space-y-6">
        {/* Step 0: Review Scope / Confirm Package */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">{steps[0]}</h2>
            <div className="space-y-2">
              {quote.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-2 border-b border-warm-100 last:border-0">
                  <span className="text-warm-700">{item.name} {item.quantity > 1 && `×${item.quantity}`}</span>
                  <span className="font-mono text-warm-600">{formatINR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="bg-fox-50 rounded-2xl p-4">
              <div className="text-xs font-bold text-fox-700 uppercase tracking-wide mb-1">
                {range.format === 'flat' ? 'Fixed Price' : 'Estimated Range'}
              </div>
              <div className="text-xl font-black text-fox-900">
                {range.format === 'flat' ? formatINR(range.mid) : `${formatINR(range.low)} – ${formatINR(range.high)}`}
              </div>
              {tier !== 'STARTER' && <p className="text-[11px] text-fox-600 mt-1">±15% tolerance from mid-range. Final quote confirmed after review.</p>}
            </div>
          </div>
        )}

        {/* Step 1: Account / Your Details / Organisation */}
        {(steps[step] === 'Your Details' || steps[step] === 'Account' || steps[step] === 'Organisation') && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">{steps[step]}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input placeholder="Full Name" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} className="input-fx" />
              <input placeholder="Phone" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} className="input-fx" />
              <input placeholder="Email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className="input-fx sm:col-span-2" />
              {tier !== 'STARTER' && (
                <>
                  <input placeholder="Organisation Name" value={account.orgName} onChange={(e) => setAccount({ ...account, orgName: e.target.value })} className="input-fx" />
                  <input placeholder="GSTIN (optional)" value={account.gstin} onChange={(e) => setAccount({ ...account, gstin: e.target.value })} className="input-fx" />
                </>
              )}
            </div>
            {tier === 'STARTER' && <p className="text-xs text-warm-400">No GSTIN, org details, or KYC required for Starter packages.</p>}
          </div>
        )}

        {/* Step 2: Project Setup / Engagement */}
        {(steps[step] === 'Project Setup' || steps[step] === 'Engagement') && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">{steps[step]}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input placeholder="Project Name" value={project.projectName} onChange={(e) => setProject({ ...project, projectName: e.target.value })} className="input-fx" />
              <input type="date" value={project.startDate} onChange={(e) => setProject({ ...project, startDate: e.target.value })} className="input-fx" />
              <select value={project.commsPreference} onChange={(e) => setProject({ ...project, commsPreference: e.target.value })} className="input-fx">
                <option>Email</option>
                <option>WhatsApp</option>
                <option>Slack</option>
              </select>
              {tier === 'PREMIUM' && (
                <select value={engagementModel} onChange={(e) => setEngagementModel(e.target.value)} className="input-fx">
                  <option value="FPM">Fixed Price Model</option>
                  <option value="TNM">Time &amp; Materials</option>
                  <option value="RET">Retainer</option>
                  <option value="DED">Dedicated Team</option>
                  <option value="DSC">Discovery</option>
                </select>
              )}
            </div>
          </div>
        )}

        {/* Step: Payment Terms */}
        {steps[step] === 'Payment Terms' && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">Payment Terms</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPaymentMode('MILESTONE')} className={`p-4 rounded-2xl border-2 text-left ${paymentMode === 'MILESTONE' ? 'border-fox-500 bg-fox-50' : 'border-warm-200'}`}>
                <div className="font-bold text-sm text-warm-900">Milestone</div>
                <div className="text-xs text-warm-500 mt-1">30% now, rest on delivery</div>
              </button>
              <button onClick={() => setPaymentMode('UPFRONT')} className={`p-4 rounded-2xl border-2 text-left ${paymentMode === 'UPFRONT' ? 'border-fox-500 bg-fox-50' : 'border-warm-200'}`}>
                <div className="font-bold text-sm text-warm-900">Upfront</div>
                <div className="text-xs text-warm-500 mt-1">5% discount — pay 95% now</div>
              </button>
            </div>
            <div className="bg-warm-50 rounded-xl p-3 text-sm flex justify-between">
              <span className="text-warm-600">Due now</span>
              <span className="font-mono font-bold">{formatINR(payAmount)}</span>
            </div>
          </div>
        )}

        {/* Step: Invoice Preview */}
        {steps[step] === 'Invoice' && (
          <InvoicePreview
            quote={quote}
            account={account}
            paymentMode={effectivePaymentMode}
            onContinue={() => setStep((s) => s + 1)}
            onBack={back}
          />
        )}

        {/* Step: Contract Signing */}
        {steps[step] === 'Contract' && (
          <ContractSigning
            quote={quote}
            account={account}
            tier={tier}
            onContinue={() => setStep((s) => s + 1)}
            onBack={back}
          />
        )}

        {/* Step: Docs & Pay (Growth) */}
        {steps[step] === 'Docs & Pay' && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">Documents &amp; Pay</h2>
            <div className="bg-warm-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-warm-500 uppercase tracking-wide mb-1">
                <FileText size={14} /> Documents generated for this order
              </div>
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> Contract reviewed and signed in previous step
              </p>
            </div>
            <div className="bg-warm-50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-warm-600">Amount due</span>
              <span className="font-mono font-black text-xl">{formatINR(payAmount)}</span>
            </div>
            <p className="text-xs text-warm-400">
              UPI, card, netbanking, or EMI (orders ≥₹15,000). Payment confirms the documents accepted in the previous step.
            </p>
            <Button variant="primary" className="w-full" isLoading={paying} onClick={handlePay}>
              <CreditCard size={16} className="mr-2" /> Pay {formatINR(payAmount)}
            </Button>
          </div>
        )}

        {/* Step: Docs & E-Sign (Premium) */}
        {steps[step] === 'Docs & E-Sign' && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">Docs &amp; E-Sign</h2>
            <div className="bg-warm-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-warm-500 uppercase tracking-wide mb-1">
                <FileText size={14} /> Documents generated for this order
              </div>
              {['SOW', 'MSA', 'NDA', 'IP Assignment Deed', 'DPA'].map((doc) => (
                <div key={doc} className="text-sm text-warm-700 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> {doc}</div>
              ))}
            </div>
            <label className="flex items-start gap-3 text-sm text-warm-700 cursor-pointer">
              <input type="checkbox" checked={docsAccepted} onChange={(e) => setDocsAccepted(e.target.checked)} className="mt-1" />
              <span>I've reviewed and accept the full document suite. Aadhaar e-sign follows for orders ≥₹5L.</span>
            </label>
            <Button variant="primary" className="w-full gap-1" disabled={!docsAccepted} onClick={next}>
              Continue to Payment <ArrowRight size={14} />
            </Button>
          </div>
        )}

        {/* Step: Pay (Starter step 3, Premium step 7) */}
        {steps[step] === 'Pay' && (
          <div className="space-y-4">
            <h2 className="font-bold text-warm-900">Pay</h2>
            <div className="bg-warm-50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-warm-600">Amount due</span>
              <span className="font-mono font-black text-xl">{formatINR(payAmount)}</span>
            </div>
            <p className="text-xs text-warm-400">
              UPI, card, netbanking, or EMI (orders ≥₹15,000).{' '}
              {tier === 'STARTER' ? 'Agreement auto-accepted on payment.' : 'Payment confirms the documents accepted in the previous step.'}
            </p>
            <Button variant="primary" className="w-full" isLoading={paying} onClick={handlePay}>
              <CreditCard size={16} className="mr-2" /> Pay {formatINR(payAmount)}
            </Button>
          </div>
        )}

        {/* Confirm step (Premium, post-payment) */}
        {steps[step] === 'Confirm' && (
          <div className="space-y-4 text-center py-4">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="font-bold text-warm-900 text-lg">Payment confirmed</h2>
            <p className="text-sm text-warm-600">Your dedicated PM will reach out within 24 hours to schedule the kickoff call.</p>
            <Link to="/app/client/quotes" className="btn-fox inline-flex mt-2">Go to My Quotes</Link>
          </div>
        )}

        {/* Nav buttons — hidden on steps that render their own CTA above */}
        {!['Pay', 'Confirm', 'Docs & Pay', 'Docs & E-Sign', 'Invoice', 'Contract'].includes(steps[step]) && (
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-1"><ArrowLeft size={14} /> Back</Button>
            <Button variant="primary" onClick={next} className="gap-1">Continue <ArrowRight size={14} /></Button>
          </div>
        )}
        {['Pay', 'Confirm', 'Docs & Pay', 'Docs & E-Sign', 'Invoice', 'Contract'].includes(steps[step]) && step > 0 && (
          <div className="flex justify-start">
            <Button variant="ghost" onClick={back} className="gap-1"><ArrowLeft size={14} /> Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}
