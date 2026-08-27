import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search, ChevronDown, ChevronUp, User, Building2, FileText, ScrollText, ShieldCheck, PenTool, Clock, CheckCircle2, ExternalLink, Mail, IndianRupee, Package } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button, Input } from '@components/ui/Primitives';
import api from '@lib/api';

const CONTRACT_TYPE_LABELS = {
  SOW: 'Statement of Work', MSA: 'Master Service Agreement', NDA: 'Non-Disclosure Agreement',
  IP_WFH: 'IP Assignment', DPA: 'Data Processing Agreement', MICRO_SOW: 'Micro SOW',
};

export default function Purchases() {
  usePageTitle('Purchases');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState('');

  const fetchItems = () => {
    setLoading(true);
    api.get('/admin/purchases', { params: { limit: 100, q: query || undefined } })
      .then((r) => setItems(r.data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchItems();
  };

  const getStatusBadgeVariant = (status) => {
    const variant = getStatusBadge(status)?.replace('badge-', '');
    if (variant) return variant;
    if (status === 'PAID' || status === 'ACCEPTED' || status === 'EXECUTED') return 'success';
    if (status === 'PENDING' || status === 'DRAFT') return 'warning';
    if (status === 'CANCELLED' || status === 'TERMINATED') return 'danger';
    return 'neutral';
  };

  const renderClientCard = (client, contact) => (
    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-warm-400" />
        <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">Client Details</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">Organization</div>
          <div className="font-semibold text-warm-900">{client?.name || 'N/A'}</div>
          <div className="text-xs text-warm-500 font-mono">{client?.id || '–'}</div>
        </div>
        <div>
          <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">Type & Tier</div>
          <div className="font-medium text-warm-800">{client?.type || '–'} {client?.tier ? `• ${client?.tier}` : ''}</div>
        </div>
        <div>
          <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">GSTIN</div>
          <div className="font-mono text-xs text-warm-700">{client?.gstin || 'Not provided'} {client?.gstinVerified && <span className="text-emerald-600 text-[10px] ml-1">✓ Verified</span>}</div>
        </div>
        <div>
          <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">PAN</div>
          <div className="font-mono text-xs text-warm-700">{client?.pan || 'Not provided'}</div>
        </div>
        <div>
          <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">Health State</div>
          <Badge variant={client?.healthState === 'ACTIVE' ? 'success' : client?.healthState === 'DORMANT' ? 'warning' : 'neutral'} className="text-[10px]">{client?.healthState || 'N/A'}</Badge>
        </div>
        <div>
          <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">KYC Status</div>
          <Badge variant={client?.kycStatus === 'CLEARED' ? 'success' : client?.kycStatus === 'ENHANCED' ? 'info' : 'warning'} className="text-[10px]">{client?.kycStatus || 'NONE'}</Badge>
        </div>
        {contact && (
          <>
            <div>
              <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">Primary Contact</div>
              <div className="font-medium text-warm-800">{contact.name || '–'}</div>
              <div className="text-xs text-warm-500">{contact.email || '–'}</div>
              <div className="text-xs text-warm-500">{contact.phone || '–'}</div>
            </div>
            <div>
              <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1">Contact Email</div>
              <div className="text-xs text-warm-700">{client?.contactEmail || contact.email || '–'}</div>
              <div className="text-[10px] text-warm-400 uppercase tracking-wider mb-1 mt-2">Contact Phone</div>
              <div className="text-xs text-warm-700">{client?.contactPhone || contact.phone || '–'}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderItems = (items) => (
    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
      <div className="flex items-center gap-2 mb-3">
        <Package size={16} className="text-warm-400" />
        <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">Items Purchased</span>
      </div>
      {items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((sub, i) => (
            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border border-warm-100/60">
              <div>
                <div className="text-sm font-bold text-warm-900">{sub.name || sub.serviceId || 'Item'}</div>
                <div className="text-[10px] text-warm-500">Qty: {sub.quantity || 1} {sub.serviceId ? `• ID: ${sub.serviceId}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-warm-400">No line items recorded</div>
      )}
    </div>
  );

  const renderContracts = (contracts) => (
    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText size={16} className="text-warm-400" />
        <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">Contracts</span>
      </div>
      {contracts && contracts.length > 0 ? (
        <div className="space-y-2">
          {contracts.map((c) => {
            const clientSig = c.signatures?.find(s => s.side === 'CLIENT');
            const sfSig = c.signatures?.find(s => s.side === 'STACKFOX');
            return (
              <div key={c.id} className="bg-white p-3 rounded-lg border border-warm-100/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-warm-900">{CONTRACT_TYPE_LABELS[c.type] || c.type}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-fox-50 text-fox-700 uppercase">{c.type}</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(c.status)}>{c.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-warm-500">
                  <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(c.createdAt)}</span>
                  <span className={`flex items-center gap-1 ${clientSig ? 'text-emerald-600' : 'text-warm-400'}`}>
                    {clientSig ? <CheckCircle2 size={10} /> : <Clock size={10} />} Client {clientSig ? 'signed' : 'pending'}
                  </span>
                  <span className={`flex items-center gap-1 ${sfSig ? 'text-emerald-600' : 'text-warm-400'}`}>
                    {sfSig ? <CheckCircle2 size={10} /> : <Clock size={10} />} StackFox {sfSig ? 'signed' : 'pending'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-warm-400">No contracts found</div>
      )}
    </div>
  );

  const renderProjects = (projects) => (
    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-warm-400" />
        <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">Projects</span>
      </div>
      {projects && projects.length > 0 ? (
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="bg-white p-3 rounded-lg border border-warm-100/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-warm-900">{p.name || p.id}</span>
                <Badge variant={getStatusBadgeVariant(p.status)} className="text-[10px]">{p.status}</Badge>
              </div>
              <div className="text-xs text-warm-500">Service: {p.service?.name || p.serviceId || '–'}</div>
              <div className="text-xs text-warm-500">Milestones: {p.milestones?.length || 0}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-warm-400">No projects found</div>
      )}
    </div>
  );

  const renderPayments = (payments) => (
    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
      <div className="flex items-center gap-2 mb-3">
        <IndianRupee size={16} className="text-warm-400" />
        <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">Payments</span>
      </div>
      {payments && payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map((pay) => (
            <div key={pay.id} className="bg-white p-3 rounded-lg border border-warm-100/60 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-warm-900">{formatINR(pay.amount / 100)}</div>
                <div className="text-[10px] text-warm-500">{pay.gateway} • {pay.method || '–'} • {formatDate(pay.createdAt)}</div>
              </div>
              <Badge variant={getStatusBadgeVariant(pay.status)} className="text-[10px]">{pay.status}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-warm-400">No payment records found</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-warm-900">Purchases</h1>
          <p className="text-sm text-warm-500">Unified view of every client purchase with contracts, items, and client details.</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Search by ID, client, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
          <Button type="submit" variant="primary" size="sm" className="rounded-xl gap-1.5">
            <Search size={14} /> Search
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No purchases found" description="Completed purchases will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-[2rem] border border-warm-200 overflow-hidden transition-all duration-300">
              <div className="p-5 md:p-6 cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-warm-50 flex items-center justify-center text-warm-400">
                      <ShoppingBag size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-warm-900">{item.kind === 'quote' ? item.quoteNumber : item.id}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-warm-100 text-warm-600 uppercase">{item.kind}</span>
                        <Badge variant={getStatusBadgeVariant(item.status)}>{capitalize(item.status)}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-warm-500 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-warm-700">
                          <User size={12} /> {item.client?.name || 'Anonymous'}
                        </span>
                        {item.client?.contactEmail && <><span className="text-warm-300">·</span><span>{item.client.contactEmail}</span></>}
                        {item.contact?.email && !item.client?.contactEmail && <><span className="text-warm-300">·</span><span>{item.contact.email}</span></>}
                        <span className="text-warm-300">·</span>
                        <span>{formatDate(item.date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      <div className="text-[10px] text-warm-400 font-bold uppercase tracking-widest">Total</div>
                      <div className="font-mono text-xl font-black text-warm-900">{formatINR(item.total)}</div>
                    </div>
                    <button className="p-2 hover:bg-warm-100 rounded-xl transition-colors">
                      {expandedId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === item.id && (
                <div className="px-5 md:px-6 pb-6 pt-2 border-t border-warm-100 animate-slide-up">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                    <div className="space-y-4">
                      {renderClientCard(item.client, item.contact)}
                      {renderItems(item.items)}
                    </div>
                    <div className="space-y-4">
                      {renderContracts(item.contracts)}
                      {renderProjects(item.projects)}
                      {renderPayments(item.payments)}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {item.client && (
                      <Link to={`/app/admin/users?id=${item.client.id}`} className="btn-outline py-2 px-4 rounded-xl text-xs gap-2 inline-flex items-center">
                        <User size={14} /> User Profile
                      </Link>
                    )}
                    {item.engagement && (
                      <Link to={`/app/admin/engagements`} className="btn-outline py-2 px-4 rounded-xl text-xs gap-2 inline-flex items-center">
                        <Handshake size={14} /> View Engagement
                      </Link>
                    )}
                    {(item.contact?.email || item.client?.contactEmail) && (
                      <a href={`mailto:${item.contact?.email || item.client?.contactEmail}`} className="btn-outline py-2 px-4 rounded-xl text-xs gap-2 inline-flex items-center">
                        <Mail size={14} /> Email Client
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
