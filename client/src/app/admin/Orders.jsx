import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, MessageSquare, ExternalLink, ChevronDown, ChevronUp, User, ScrollText, FileText, ShieldCheck, PenTool, Clock, CheckCircle2 } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const CONTRACT_TYPE_LABELS = {
  SOW: 'Statement of Work', MSA: 'Master Service Agreement', NDA: 'Non-Disclosure Agreement',
  IP_WFH: 'IP Assignment', DPA: 'Data Processing Agreement', MICRO_SOW: 'Micro SOW',
};
const CONTRACT_STATUS = {
  DRAFT: 'warning', CLIENT_SIGNED: 'info', EXECUTED: 'success', AMENDED: 'info', TERMINATED: 'danger',
};

export default function Orders() {
  usePageTitle('Admin Orders');
  const [tab, setTab] = useState('quotes');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchItems = () => {
    setLoading(true);
    const endpoint = tab === 'quotes' ? '/quotes' : tab === 'invoices' ? '/invoices' : '/contracts';
    api.get(endpoint, { params: { limit: 100 } })
      .then((r) => setItems(r.data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [tab]);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const endpoint = tab === 'quotes' ? `/quotes/${id}/status` : `/invoices/${id}/status`;
      await api.patch(endpoint, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchItems();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update status');
    }
  };

  const contactUser = (email, phone, name, quoteNum) => {
    const msg = `Hi ${name}, this is about your quote ${quoteNum} on StackFox...`;
    if (phone) {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`mailto:${email}?subject=Regarding your quote ${quoteNum}&body=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  // Quotes use the sales workflow; invoices are serialized lowercase with
  // dashes on the backend ("partially-paid"), matching what item.status holds.
  const statusOptions = tab === 'quotes'
    ? ['draft', 'reviewing', 'approved', 'invoiced', 'cancelled']
    : tab === 'invoices'
    ? ['draft', 'sent', 'viewed', 'partially-paid', 'paid', 'overdue', 'cancelled']
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-warm-900">Orders & Billing</h2>
          <p className="text-sm text-warm-500">Manage client quotes, invoices, contracts, and payment tracking.</p>
        </div>
      </div>

      <div className="flex bg-warm-100/50 p-1 rounded-2xl w-fit">
        {['quotes', 'invoices', 'contracts'].map((t) => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t ? 'bg-white text-fox-500 shadow-sm' : 'text-warm-500 hover:text-warm-900'
            }`}
          >
            {capitalize(t)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={tab === 'contracts' ? ScrollText : ShoppingBag} title={`No ${tab} found`} description={`Check back later for new ${tab}.`} />
      ) : tab === 'contracts' ? (
        <div className="space-y-3">
          {items.map((c) => {
            const clientSig = c.signatures?.find(s => s.side === 'CLIENT');
            const sfSig = c.signatures?.find(s => s.side === 'STACKFOX');
            return (
              <div key={c._id} className="bg-white rounded-[2rem] border border-warm-200 p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      c.status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-600' :
                      c.status === 'CLIENT_SIGNED' ? 'bg-blue-50 text-blue-600' :
                      'bg-warm-100 text-warm-500'
                    }`}>
                      <ScrollText size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-warm-900 text-sm">{CONTRACT_TYPE_LABELS[c.type] || c.type}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-fox-50 text-fox-700 uppercase">{c.type}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-warm-500">
                        <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(c.createdAt)}</span>
                        {c.engagementId && <><span className="text-warm-300">·</span><span className="font-mono">{c.engagementId}</span></>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-[10px] flex items-center gap-1 ${clientSig ? 'text-emerald-600' : 'text-warm-400'}`}>
                          {clientSig ? <CheckCircle2 size={10} /> : <Clock size={10} />} Client {clientSig ? 'signed' : 'pending'}
                        </span>
                        <span className={`text-[10px] flex items-center gap-1 ${sfSig ? 'text-emerald-600' : 'text-warm-400'}`}>
                          {sfSig ? <CheckCircle2 size={10} /> : <Clock size={10} />} StackFox {sfSig ? 'signed' : 'pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={CONTRACT_STATUS[c.status] || 'warning'}>{c.status}</Badge>
                    {c.status === 'CLIENT_SIGNED' && (
                      <Button variant="primary" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={async () => {
                        try {
                          await api.post(`/contracts/${c._id}/countersign`);
                          toast.success('Contract countersigned');
                          fetchItems();
                        } catch (err) {
                          toast.error(err?.response?.data?.error || 'Failed to countersign');
                        }
                      }}>
                        <PenTool size={12} /> Countersign
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div 
              key={item._id} 
              className={`bg-white rounded-[2rem] border transition-all duration-300 ${
                expandedId === item._id ? 'border-fox-200 shadow-xl ring-1 ring-fox-100' : 'border-warm-200 hover:border-warm-300'
              }`}
            >
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-warm-50 flex items-center justify-center text-warm-400">
                      <ShoppingBag size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-warm-900">{item.quoteNumber || item.invoiceNumber}</h3>
                        <Badge variant={getStatusBadge(item.status)?.replace('badge-', '')}>{capitalize(item.status)}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-warm-500">
                        <span className="flex items-center gap-1 font-semibold text-warm-700">
                          <User size={12} /> {item.client?.name || 'Anonymous User'}
                        </span>
                        <span>&bull;</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                      <div className="text-xs text-warm-400 font-bold uppercase tracking-widest">Total Amount</div>
                      <div className="font-mono text-xl font-black text-warm-900">{formatINR(tab === 'quotes' ? item.total : (item.grandTotal ?? item.total))}</div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-warm-200"
                        onClick={() => contactUser(item.client?.email, item.client?.phone, item.client?.name, item.quoteNumber || item.invoiceNumber)}
                      >
                        <MessageSquare size={14} className="text-emerald-500" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-warm-200"
                        onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
                      >
                        {expandedId === item._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </div>
                  </div>
                </div>

                {expandedId === item._id && (
                  <div className="mt-8 pt-6 border-t border-warm-100 animate-slide-up">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Items List */}
                      <div>
                        <h4 className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-4">Itemized Breakdown</h4>
                        <div className="space-y-2">
                          {item.items?.map((sub, i) => (
                            <div key={i} className="flex justify-between items-center bg-warm-50 p-3 rounded-xl border border-warm-100/50">
                              <div>
                                <div className="text-sm font-bold text-warm-900">{sub.name}</div>
                                <div className="text-[10px] text-warm-500">{sub.quantity} units &bull; {formatINR(sub.price)}/ea</div>
                              </div>
                              <div className="font-mono text-sm font-bold text-warm-800">{formatINR(sub.price * sub.quantity)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Management Actions */}
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-4">Update Workflow Status</h4>
                          <div className="flex flex-wrap gap-2">
                            {statusOptions.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusUpdate(item._id, s)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                  item.status === s 
                                    ? 'bg-fox-500 text-white border-fox-600' 
                                    : 'bg-white text-warm-500 border-warm-200 hover:border-fox-300'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-4">Quick Actions</h4>
                          <div className="flex flex-wrap gap-3">
                            <Link to={`/app/admin/users?id=${item.client?._id}`} className="btn-outline py-2 px-4 rounded-xl text-xs gap-2">
                              <User size={14} /> User Profile
                            </Link>
                            <a href={`mailto:${item.client?.email}`} className="btn-outline py-2 px-4 rounded-xl text-xs gap-2">
                              <Mail size={14} /> Send Email
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
