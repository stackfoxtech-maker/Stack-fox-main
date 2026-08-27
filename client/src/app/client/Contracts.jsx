import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScrollText, Download, ChevronRight, ArrowRight, FileText, ShieldCheck, Clock, PenTool, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';

const CONTRACT_TYPE_LABELS = {
  SOW: 'Statement of Work',
  MSA: 'Master Service Agreement',
  NDA: 'Non-Disclosure Agreement',
  IP_WFH: 'IP Assignment (Work for Hire)',
  IP_LIC: 'IP License',
  DPA: 'Data Processing Agreement',
  MICRO_SOW: 'Micro SOW',
  TNM_WO: 'Time & Materials Work Order',
  RET_AGR: 'Retainer Agreement',
  DED_AGR: 'Dedicated Team Agreement',
  DSC_CHARTER: 'Discovery Charter',
  CR: 'Change Request',
};

const STATUS_CONFIG = {
  DRAFT: { variant: 'warning', label: 'Draft', icon: FileText },
  CLIENT_SIGNED: { variant: 'info', label: 'Client Signed', icon: PenTool },
  EXECUTED: { variant: 'success', label: 'Executed', icon: ShieldCheck },
  AMENDED: { variant: 'info', label: 'Amended', icon: FileText },
  TERMINATED: { variant: 'danger', label: 'Terminated', icon: AlertCircle },
};

function ContractStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { variant: 'warning', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function ContractTypeTag({ type }) {
  return (
    <span className="inline-flex items-center gap-1 bg-fox-50 text-fox-700 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide">
      <FileText size={10} /> {type}
    </span>
  );
}

export default function Contracts() {
  usePageTitle('Contracts');
  const { id } = useParams();
  const [contracts, setContracts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/contracts').then(r => {
      setContracts(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (id) {
      api.get(`/contracts/${id}`).then(r => setSelected(r.data.data)).catch(() => {});
    }
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  // Detail view
  if (id && selected) {
    const statusConfig = STATUS_CONFIG[selected.status] || { label: selected.status };
    const clientSig = selected.signatures?.find(s => s.side === 'CLIENT');
    const sfSig = selected.signatures?.find(s => s.side === 'STACKFOX');

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-warm-500">
          <Link to="/app/client/contracts" className="hover:text-fox-500 flex items-center gap-1">
            <ArrowLeft size={14} /> All Contracts
          </Link>
          <ChevronRight size={14} />
          <span className="text-warm-900 font-medium">{CONTRACT_TYPE_LABELS[selected.type] || selected.type}</span>
        </div>

        {/* Contract Header */}
        <div className="bg-white rounded-[2rem] border border-warm-200 overflow-hidden">
          <div className="bg-warm-50 px-6 py-4 border-b border-warm-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fox-50 text-fox-500 flex items-center justify-center">
                <ScrollText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-warm-900">{CONTRACT_TYPE_LABELS[selected.type] || selected.type}</h2>
                <ContractTypeTag type={selected.type} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ContractStatusBadge status={selected.status} />
              {selected.fileKey && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/contracts/${id}/pdf`);
                      window.open(res.data.url, '_blank');
                    } catch {
                      // PDF not available
                    }
                  }}
                >
                  <Download size={14} /> Download PDF
                </Button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Details grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Contract ID</span>
                <p className="text-sm font-mono text-warm-700 mt-1 truncate">{selected.id}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Created</span>
                <p className="text-sm text-warm-700 mt-1">{formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Engagement</span>
                <p className="text-sm font-mono text-warm-700 mt-1">{selected.engagementId || '—'}</p>
              </div>
              {selected.executedAt && (
                <div>
                  <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Executed</span>
                  <p className="text-sm text-warm-700 mt-1">{formatDate(selected.executedAt)}</p>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div>
              <h3 className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-3">Signatures</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Client signature */}
                <div className={`rounded-xl border p-4 ${clientSig ? 'border-emerald-200 bg-emerald-50' : 'border-warm-200 bg-warm-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {clientSig ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : (
                      <Clock size={14} className="text-warm-400" />
                    )}
                    <span className="text-xs font-bold text-warm-700">Client</span>
                  </div>
                  {clientSig ? (
                    <div>
                      <p className="text-sm font-serif italic text-warm-900">{clientSig.evidence?.name || 'Signed'}</p>
                      <p className="text-[10px] text-warm-500 mt-1">
                        {formatDate(clientSig.signedAt)} · {clientSig.rail === 'CLICK' ? 'Electronic Signature' : clientSig.rail}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-warm-400">Awaiting signature</p>
                  )}
                </div>

                {/* StackFox signature */}
                <div className={`rounded-xl border p-4 ${sfSig ? 'border-emerald-200 bg-emerald-50' : 'border-warm-200 bg-warm-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {sfSig ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : (
                      <Clock size={14} className="text-warm-400" />
                    )}
                    <span className="text-xs font-bold text-warm-700">StackFox</span>
                  </div>
                  {sfSig ? (
                    <div>
                      <p className="text-sm text-warm-900">Countersigned</p>
                      <p className="text-[10px] text-warm-500 mt-1">{formatDate(sfSig.signedAt)}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-warm-400">Pending countersignature</p>
                  )}
                </div>
              </div>
            </div>

            {/* Engagement link */}
            {selected.engagement && (
              <div className="bg-warm-50 rounded-xl p-4">
                <h3 className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-2">Linked Engagement</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-warm-700">{selected.engagement.id}</p>
                    <p className="text-xs text-warm-500 mt-0.5">Model: {selected.engagement.model || '—'}</p>
                  </div>
                  <Link to={`/app/client/engagement`} className="text-xs text-fox-500 font-semibold hover:text-fox-600 flex items-center gap-1">
                    View <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-warm-900">Contracts &amp; Agreements</h2>
          <p className="text-sm text-warm-500">Legal documents for your engagements with StackFox.</p>
        </div>
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No contracts yet"
          description="Contracts are generated when you complete checkout and sign the service agreement. Purchase a service to get started."
        />
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const typeLabel = CONTRACT_TYPE_LABELS[c.type] || c.type;
            const clientSig = c.signatures?.find(s => s.side === 'CLIENT');
            const sfSig = c.signatures?.find(s => s.side === 'STACKFOX');

            return (
              <Link
                key={c.id}
                to={`/app/client/contracts/${c.id}`}
                className="bg-white rounded-[2rem] border border-warm-200 p-5 md:p-6 flex items-center justify-between hover:shadow-lg transition-shadow group block"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    c.status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-600' :
                    c.status === 'CLIENT_SIGNED' ? 'bg-blue-50 text-blue-600' :
                    'bg-warm-100 text-warm-500'
                  }`}>
                    <ScrollText size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-warm-900 text-sm">{typeLabel}</p>
                      <ContractTypeTag type={c.type} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-warm-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(c.createdAt)}</span>
                      {c.engagementId && (
                        <>
                          <span className="text-warm-300">·</span>
                          <span className="font-mono truncate">{c.engagementId}</span>
                        </>
                      )}
                    </div>
                    {/* Signature status inline */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-[10px] flex items-center gap-1 ${clientSig ? 'text-emerald-600' : 'text-warm-400'}`}>
                        {clientSig ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        Client {clientSig ? 'signed' : 'pending'}
                      </span>
                      <span className={`text-[10px] flex items-center gap-1 ${sfSig ? 'text-emerald-600' : 'text-warm-400'}`}>
                        {sfSig ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        StackFox {sfSig ? 'signed' : 'pending'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <ContractStatusBadge status={c.status} />
                  <ArrowRight size={16} className="text-warm-300 group-hover:text-fox-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
