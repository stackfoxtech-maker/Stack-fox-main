import { useState } from 'react';
import { Search, Plus, Filter, X, Phone, Mail, Globe, MapPin, Building2, Calendar, IndianRupee } from 'lucide-react';
import { Button, Input, Textarea, Select, Modal, Badge } from '@components/ui/Primitives';
import { businessCategories, leadStatuses } from '@data/salesPitchLibrary';
import { cn, formatDate } from '@lib/utils';

const mockLeads = [
  { id: 1, businessName: 'FitZone Gym', ownerName: 'Rahul Verma', contact: '+91 98765 43210', email: 'rahul@fitzone.com', category: 'gym', location: 'Patna', status: 'New Lead', priority: 'High', value: 50000, date: '2026-08-26' },
  { id: 2, businessName: 'Spice Garden Restaurant', ownerName: 'Priya Sharma', contact: '+91 87654 32109', email: 'priya@spicegarden.com', category: 'restaurant', location: 'Patna', status: 'Interested', priority: 'Medium', value: 35000, date: '2026-08-25' },
  { id: 3, businessName: 'Patna Dental Care', ownerName: 'Dr. Amit Kumar', contact: '+91 76543 21098', email: 'amit@patnadental.com', category: 'dental', location: 'Patna', status: 'Meeting Scheduled', priority: 'High', value: 45000, date: '2026-08-24' },
];

export default function Leads() {
  const [leads, setLeads] = useState(mockLeads);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    businessName: '', ownerName: '', contact: '', email: '', category: '', location: '', website: '', socialMedia: '', status: 'New Lead', priority: 'Medium', value: '', notes: '',
  });

  const filtered = leads.filter((l) => {
    if (search && !l.businessName.toLowerCase().includes(search.toLowerCase()) && !l.ownerName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLeads([...leads, { ...form, id: Date.now(), value: Number(form.value) || 0, date: new Date().toISOString().split('T')[0] }]);
    setShowModal(false);
    setForm({ businessName: '', ownerName: '', contact: '', email: '', category: '', location: '', website: '', socialMedia: '', status: 'New Lead', priority: 'Medium', value: '', notes: '' });
  };

  const getPriorityColor = (p) => ({ High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-neutral' }[p] || 'badge-neutral');
  const getStatusColor = (s) => {
    const map = { 'New Lead': 'badge-info', 'Contacted': 'badge-info', 'Interested': 'badge-fox', 'Meeting Scheduled': 'badge-warning', 'Demo Completed': 'badge-warning', 'Proposal Sent': 'badge-fox', 'Negotiation': 'badge-warning', 'Won': 'badge-success', 'Not Interested': 'badge-neutral', 'Lost': 'badge-danger', 'Follow Up Later': 'badge-neutral' };
    return map[s] || 'badge-neutral';
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

      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
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
                <th className="text-left px-5 py-3.5 font-medium text-warm-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-warm-50/50 transition">
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
                  <td className="px-5 py-3.5 text-warm-500">{formatDate(lead.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-10 text-center text-warm-500">No leads found</div>}
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
