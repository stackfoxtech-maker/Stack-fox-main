import { useEffect, useState } from 'react';
import { FileText, Download, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
// Lazy — keeps jsPDF out of the dashboard bundle (PERF_AUDIT P0-3).
const exportQuotePDF = (...args) =>
  import('@lib/pdfExport').then((m) => m.exportQuotePDF(...args));
import api from '@lib/api';

export default function Quotes() {
  usePageTitle('My Quotes');
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/quotes')
      .then((r) => setQuotes(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-warm-900">Quotes & Estimates</h2>
          <p className="text-sm text-warm-500">Track your service requests and approved estimates.</p>
        </div>
      </div>

      {quotes.length === 0 ? (
        <EmptyState 
          icon={FileText} 
          title="No quotes yet" 
          description="Build your perfect service stack and request a quote to see it here." 
        />
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => (
            <div key={q._id} className="bg-white rounded-[2rem] border border-warm-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-fox-50 text-fox-500 flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-warm-900">{q.quoteNumber}</h3>
                        <Badge variant={getStatusBadge(q.status)?.replace('badge-', '')}>{capitalize(q.status)}</Badge>
                      </div>
                      <div className="text-xs text-warm-500 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(q.createdAt)}</span>
                        <span>&bull;</span>
                        <span>Valid until {formatDate(q.validUntil)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-1">Grand Total</div>
                    <div className="font-mono text-2xl font-black text-fox-500">{formatINR(q.total)}</div>
                  </div>
                </div>

                <div className="bg-warm-50 rounded-3xl p-6 mb-6">
                  <h4 className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-4">Included Services</h4>
                  <div className="space-y-3">
                    {q.items?.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="font-semibold text-warm-800">{item.name}</span>
                          {item.quantity > 1 && <span className="text-xs text-warm-400">×{item.quantity}</span>}
                        </div>
                        <span className="font-mono text-warm-600">{formatINR(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-warm-200/60 flex justify-between text-xs font-medium text-warm-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatINR(q.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs font-medium text-warm-500">
                    <span>Tax (GST 18%)</span>
                    <span className="font-mono">{formatINR(q.gstAmount)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-warm-400 italic">
                    <AlertCircle size={14} />
                    Final pricing may vary based on exact requirements.
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl border-warm-200 gap-2 font-bold"
                    onClick={() => exportQuotePDF(q.items, 0, [], [], q)}
                  >
                    <Download size={16} /> Download PDF
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
