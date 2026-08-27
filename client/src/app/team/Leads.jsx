import { useState, useMemo } from 'react';
import { Search, Plus, Filter, X, Phone, Mail, Globe, MapPin, Building2, Calendar, IndianRupee, MessageSquare, Wand2, ChevronRight, Share2 } from 'lucide-react';
import { Button, Input, Textarea, Select, Modal, Badge } from '@components/ui/Primitives';
import { businessCategories, leadStatuses, getPitch } from '@data/salesPitchLibrary';
import { cn, formatDate } from '@lib/utils';
import { toast } from 'react-hot-toast';

const mockLeads = [
  { id: 1, businessName: 'FitZone Gym', ownerName: 'Rahul Verma', contact: '+91 98765 43210', email: 'rahul@fitzone.com', category: 'gym', location: 'Patna', status: 'New Lead', priority: 'High', value: 50000, date: '2026-08-26' },
  { id: 2, businessName: 'Spice Garden Restaurant', ownerName: 'Priya Sharma', contact: '+91 87654 32109', email: 'priya@spicegarden.com', category: 'restaurant', location: 'Patna', status: 'Interested', priority: 'Medium', value: 35000, date: '2026-08-25' },
  { id: 3, businessName: 'Patna Dental Care', ownerName: 'Dr. Amit Kumar', contact: '+91 76543 21098', email: 'amit@patnadental.com', category: 'dental', location: 'Patna', status: 'Meeting Scheduled', priority: 'High', value: 45000, date: '2026-08-24' },
];

const followUpSuggestions = {
  'New Lead': { type: 'Call', action: 'Introduce yourself and understand their current website situation', timing: 'Within 24 hours' },
  'Contacted': { type: 'WhatsApp', action: 'Send a sample website link and pricing details', timing: 'Within 48 hours' },
  'Interested': { type: 'Call', action: 'Schedule a demo or site visit to show the website proposal', timing: 'Within 24 hours' },
  'Meeting Scheduled': { type: 'Meeting', action: 'Prepare pitch presentation and proposal for the meeting', timing: 'Before meeting' },
  'Demo Completed': { type: 'Email', action: 'Send proposal and follow up with any additional questions', timing: 'Within 24 hours' },
  'Proposal Sent': { type: 'Call', action: 'Follow up on proposal review and address any concerns', timing: 'Within 3 days' },
  'Negotiation': { type: 'Call', action: 'Discuss final terms and close the deal', timing: 'ASAP' },
  'Won': { type: 'Email', action: 'Send welcome email and project kick-off details', timing: 'Immediately' },
  'Not Interested': { type: 'WhatsApp', action: 'Send a thank you message and keep the door open for future', timing: 'Within 1 week' },
  'Lost': { type: 'Email', action: 'Send a feedback request to understand why they chose another provider', timing: 'Within 1 week' },
  'Follow Up Later': { type: 'WhatsApp', action: 'Set a reminder to follow up at the agreed time', timing: 'As scheduled' },
};

export default function Leads() {
  const [leads, setLeads] = useState(mockLeads);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [form, setForm] = useState({
    businessName: '', ownerName: '', contact: '', email: '', category: '', location: '', website: '', socialMedia: '', status: 'New Lead', priority: 'Medium', value: '', notes: '',
  });

  const filtered = leads.filter((l) => {
    if (search && !l.businessName.toLowerCase().includes(search.toLowerCase()) && !l.ownerName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const selectedPitch = selectedLead ? getPitch(selectedLead.category, { name: selectedLead.businessName, city: selectedLead.location }) : null;
  const suggestion = selectedLead ? followUpSuggestions[selectedLead.status] : null;

  const pitchHistory = useMemo(() => {
    try {
      const stored = localStorage.getItem('pitchHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [selectedLead]);

  const logPitchUsage = (leadId, category, outcome) => {
    const history = JSON.parse(localStorage.getItem('pitchHistory') || '[]');
    history.push({ leadId, category, outcome, date: new Date().toISOString() });
    localStorage.setItem('pitchHistory', JSON.stringify(history.slice(-50)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newLead = { ...form, id: Date.now(), value: Number(form.value) || 0, date: new Date().toISOString().split('T')[0] };
    setLeads([...leads, newLead]);
    setShowModal(false);
    setForm({ businessName: '', ownerName: '', contact: '', email: '', category: '', location: '', website: '', socialMedia: '', status: 'New Lead', priority: 'Medium', value: '', notes: '' });
    toast.success('Lead added successfully!');
  };

  const getPriorityColor = (p) => ({ High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-neutral' }[p] || 'badge-neutral');
  const getStatusColor = (s) => {
    const map = { 'New Lead': 'badge-info', 'Contacted': 'badge-info', 'Interested': 'badge-fox', 'Meeting Scheduled': 'badge-warning', 'Demo Completed': 'badge-warning', 'Proposal Sent': 'badge-fox', 'Negotiation': 'badge-warning', 'Won': 'badge-success', 'Not Interested': 'badge-neutral', 'Lost': 'badge-danger', 'Follow Up Later': 'badge-neutral' };
    return map[s] || 'badge-neutral';
  };

  const sharePitch = (lead) => {
    const pitch = getPitch(lead.category, { name: lead.businessName, city: lead.location });
    if (!pitch) return;
    const text = encodeURIComponent('Hi ' + lead.ownerName + '! ' + pitch.whatsappPitch);
    window.open('https://wa.me/?text=' + text, '_blank');
    logPitchUsage(lead.id, lead.category, 'shared');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-display-sm text-warm-900">Leads</h2>
          <p className="text-warm-500 text-sm mt-1">Manage your sales leads and contacts</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> Add New Lead</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-warm-400" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30">
            <option value="">All Statuses</option>
            {leadStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 bg-warm-50/50">
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Business</th>
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Contact</th>
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Category</th>
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Status</th>
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Priority</th>
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Value</th>
                  <th className="text-left px-5 py-3.5 font-medium text-warm-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {filtered.map((lead) => (
                  <tr key={lead.id} className={cn('hover:bg-warm-50/50 transition cursor-pointer', selectedLead?.id === lead.id ? 'bg-fox-50/50' : '')} onClick={() => setSelectedLead(lead)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-fox-50 flex items-center justify-center text-fox-600 font-medium text-xs">
                          {lead.businessName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-warm-900">{lead.businessName}</p>
                          <p className="text-xs text-warm-500">{lead.ownerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 text-warm-600"><Phone size={12} />{lead.contact}</span>
                        <span className="flex items-center gap-1.5 text-warm-500 text-xs"><Mail size={12} />{lead.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-warm-600 capitalize">{lead.category?.replace('-', ' ')}</td>
                    <td className="px-5 py-3.5"><Badge variant={getStatusColor(lead.status)?.replace('badge-', '') || 'neutral'}>{lead.status}</Badge></td>
                    <td className="px-5 py-3.5"><Badge variant={getPriorityColor(lead.priority)?.replace('badge-', '') || 'neutral'}>{lead.priority}</Badge></td>
                    <td className="px-5 py-3.5 font-mono text-warm-900">₹{lead.value?.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); sharePitch(lead); }} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-fox-500 transition" title="Share pitch on WhatsApp">
                          <Share2 size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-fox-500 transition" title="View pitch">
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="p-10 text-center text-warm-500">No leads found</div>}
        </div>

        <div className="space-y-4">
          {selectedLead && selectedPitch ? (
            <>
              <div className="bg-white rounded-2xl border border-warm-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-warm-900">Auto Pitch</h3>
                  <Badge variant="fox">{selectedPitch.categoryName}</Badge>
                </div>
                <p className="text-sm text-warm-700 leading-relaxed mb-3">{selectedPitch.mainPitch}</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => { navigator.clipboard.writeText(selectedPitch.mainPitch); toast.success('Pitch copied!'); }}><Copy size={14} /> Copy</Button>
                  <Button size="sm" variant="outline" onClick={() => sharePitch(selectedLead)}><MessageCircle size={14} /> WhatsApp</Button>
                </div>
              </div>

              {suggestion && (
                <div className="bg-success-50 border border-success-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 size={16} className="text-success-600" />
                    <h3 className="font-semibold text-success-800">Smart Follow-Up</h3>
                  </div>
                  <p className="text-xs text-success-600 mb-1">Suggested: <span className="font-medium">{suggestion.type}</span> — {suggestion.timing}</p>
                  <p className="text-sm text-success-700">{suggestion.action}</p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-warm-200 p-5">
                <h3 className="font-semibold text-warm-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-between" onClick={() => { navigator.clipboard.writeText(selectedPitch.shortPitch); toast.success('Short pitch copied!'); }}>
                    Copy Short Pitch <ChevronRight size={16} />
                  </Button>
                  <Button variant="outline" className="w-full justify-between" onClick={() => sharePitch(selectedLead)}>
                    Share on WhatsApp <Share2 size={16} />
                  </Button>
                  <Button variant="outline" className="w-full justify-between" onClick={() => { navigator.clipboard.writeText(selectedPitch.mainPitch); toast.success('Main pitch copied!'); }}>
                    Copy Main Pitch <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-warm-50 border border-warm-200 rounded-2xl p-6 text-center">
              <MessageSquare size={32} className="text-warm-300 mx-auto mb-2" />
              <p className="text-sm text-warm-500">Select a lead to view auto-generated pitch and smart follow-up suggestions</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Lead" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Business Name" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g., FitZone Gym" />
            <Input label="Owner Name" required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="e.g., Rahul Verma" />
            <Input label="Contact Number" required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+91 98765 43210" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">Business Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-fx" required>
                <option value="">Select category</option>
                {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
              </select>
            </div>
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g., Patna" />
            <Input label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" />
            <Input label="Social Media" value={form.socialMedia} onChange={(e) => setForm({ ...form, socialMedia: e.target.value })} placeholder="@businessname" />
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-fx">
                {leadStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-fx">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <Input label="Expected Deal Value (INR)" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="50000" />
            <div className="sm:col-span-2">
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">Save Lead</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
