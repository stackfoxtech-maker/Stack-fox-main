import { useEffect, useState } from 'react';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, EmptyState, Button, Input, Textarea, Badge, Modal, Select } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Support() {
  usePageTitle('Support');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', category: 'general', priority: 'medium' });
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');

  const fetch = () => api.get('/support').then((r) => setTickets(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { fetch(); }, []);

  const create = async () => {
    if (!form.subject || !form.description) { toast.error('Fill all fields.'); return; }
    try {
      await api.post('/support', form);
      toast.success('Ticket submitted!');
      setShowNew(false);
      setForm({ subject: '', description: '', category: 'general', priority: 'medium' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      await api.post(`/support/${selected._id}/reply`, { message: reply });
      setReply('');
      const r = await api.get(`/support/${selected._id}`);
      setSelected(r.data.data.ticket);
      fetch();
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Support</h2>
        <Button variant="primary" size="sm" onClick={() => setShowNew(true)}><Plus size={16} /> New Ticket</Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="Submit a ticket if you need help." />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button key={t._id} onClick={() => api.get(`/support/${t._id}`).then((r) => setSelected(r.data.data.ticket))} className="w-full text-left bg-white rounded-xl border border-warm-200 p-4 hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-warm-900">{t.subject}</p>
                  <p className="text-xs text-warm-500 mt-0.5">{t.ticketNumber} &middot; {formatDate(t.createdAt)}</p>
                </div>
                <Badge variant={getStatusBadge(t.status)?.replace('badge-', '')}>{capitalize(t.status)}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* New ticket modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New support ticket" size="md">
        <div className="space-y-4">
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of your issue" />
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={[{ value: 'general', label: 'General' }, { value: 'bug', label: 'Bug' }, { value: 'billing', label: 'Billing' }, { value: 'feature', label: 'Feature Request' }, { value: 'urgent', label: 'Urgent' }]} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your issue in detail..." />
          <Button variant="primary" onClick={create}>Submit Ticket</Button>
        </div>
      </Modal>

      {/* Ticket detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.ticketNumber || 'Ticket'} size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-warm-900">{selected.subject}</h4>
              <p className="text-sm text-warm-600 mt-1">{selected.description}</p>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {selected.replies?.map((r, i) => (
                <div key={i} className={`p-3 rounded-xl text-sm ${r.sender?._id === selected.client?._id || r.sender?.role === 'client' ? 'bg-fox-50 ml-8' : 'bg-warm-50 mr-8'}`}>
                  <p className="font-medium text-xs text-warm-700 mb-1">{r.sender?.name || 'Support'}</p>
                  <p className="text-warm-800">{r.message}</p>
                </div>
              ))}
            </div>
            {!['resolved', 'closed'].includes(selected.status) && (
              <div className="flex gap-2">
                <input type="text" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} className="input-fx flex-1" placeholder="Type a reply..." />
                <Button variant="primary" size="icon" onClick={sendReply}><Send size={18} /></Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
