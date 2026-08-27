import { useState } from 'react';
import { Plus, Calendar, Phone, MessageCircle, Mail, Copy, CheckCircle } from 'lucide-react';
import { Button, Input, Textarea, Select, Modal, Badge } from '@components/ui/Primitives';
import { followUpTypes } from '@data/salesPitchLibrary';
import { cn, formatDate, formatDateTime } from '@lib/utils';

const typeIcons = { Call: Phone, WhatsApp: MessageCircle, Email: Mail, Meeting: Calendar, Demo: Calendar };

const mockFollowUps = [
  { id: 1, leadName: 'Rajesh Kumar', business: 'Kumar Electronics', action: 'Call to discuss proposal', type: 'Call', date: '2026-08-26', time: '10:00 AM', notes: 'Discuss website pricing and timeline', completed: false },
  { id: 2, leadName: 'Priya Sharma', business: 'Sharma Cafe', action: 'Send website mockup on WhatsApp', type: 'WhatsApp', date: '2026-08-26', time: '02:00 PM', notes: 'Send cafe website example and pricing', completed: false },
  { id: 3, leadName: 'Amit Singh', business: 'Singh Real Estate', action: 'Schedule site visit', type: 'Meeting', date: '2026-08-26', time: '04:00 PM', notes: 'Visit property location for photos', completed: false },
  { id: 4, leadName: 'Neha Gupta', business: 'Gupta Clinic', action: 'Follow up on proposal', type: 'Call', date: '2026-08-27', time: '11:00 AM', notes: 'Check if they reviewed the proposal', completed: false },
];

const suggestedMessages = {
  Call: "Hi {name}, just calling to follow up on our previous conversation about {business}. Do you have 5 minutes to discuss the next steps?",
  WhatsApp: "Hi {name}, hope you're doing well. Following up on our conversation about {business}. Here is the information I promised. Let me know if you have any questions!",
  Email: "Dear {name}, I hope this email finds you well. I wanted to follow up on our discussion about {business}. Please find the attached proposal for your review.",
  Meeting: "Hi {name}, I would like to schedule a meeting to discuss {business}. Please let me know your availability this week.",
  Demo: "Hi {name}, I would like to show you a demo of how a website can benefit {business}. Are you available for a quick 15-minute demo this week?",
};

export default function FollowUps() {
  const [followUps, setFollowUps] = useState(mockFollowUps);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leadName: '', business: '', action: '', type: 'Call', date: '', time: '', notes: '' });

  const today = new Date().toISOString().split('T')[0];
  const todayFollowUps = followUps.filter(f => f.date === today && !f.completed);
  const upcomingFollowUps = followUps.filter(f => f.date > today && !f.completed);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFollowUps([...followUps, { ...form, id: Date.now(), completed: false }]);
    setShowModal(false);
    setForm({ leadName: '', business: '', action: '', type: 'Call', date: '', time: '', notes: '' });
  };

  const toggleComplete = (id) => {
    setFollowUps(followUps.map(f => f.id === id ? { ...f, completed: !f.completed } : f));
  };

  const getSuggestedMessage = (type) => {
    return suggestedMessages[type]?.replace('{name}', form.leadName || '[Name]').replace('{business}', form.business || '[Business]') || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-display-sm text-warm-900">Follow-ups</h2>
          <p className="text-warm-500 text-sm mt-1">Manage and track your follow-up activities</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> Add Follow-Up</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-fox-500" />
            <h3 className="font-semibold text-warm-900">Today's Follow-ups ({todayFollowUps.length})</h3>
          </div>
          <div className="space-y-3">
            {todayFollowUps.length === 0 && <p className="text-sm text-warm-500 text-center py-6">No follow-ups scheduled for today</p>}
            {todayFollowUps.map((fu) => {
              const Icon = typeIcons[fu.type] || Phone;
              return (
                <div key={fu.id} className="p-4 rounded-xl border border-warm-100 hover:bg-warm-50 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-warm-900">{fu.leadName}</p>
                      <p className="text-xs text-warm-500">{fu.business}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="fox">{fu.type}</Badge>
                      <button onClick={() => toggleComplete(fu.id)} className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-success-500 transition">
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-warm-700 mb-1">{fu.action}</p>
                  <p className="text-xs text-warm-500 mb-2">{fu.notes}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-warm-400">{fu.time}</span>
                    <button onClick={() => { navigator.clipboard.writeText(getSuggestedMessage(fu.type).replace('[Name]', fu.leadName).replace('[Business]', fu.business)); }} className="text-xs text-fox-500 hover:text-fox-700 flex items-center gap-1">
                      <Copy size={12} /> Copy message
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-info-500" />
            <h3 className="font-semibold text-warm-900">Upcoming Follow-ups</h3>
          </div>
          <div className="space-y-3">
            {upcomingFollowUps.length === 0 && <p className="text-sm text-warm-500 text-center py-6">No upcoming follow-ups</p>}
            {upcomingFollowUps.map((fu) => {
              const Icon = typeIcons[fu.type] || Phone;
              return (
                <div key={fu.id} className="p-4 rounded-xl border border-warm-100 hover:bg-warm-50 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-warm-900">{fu.leadName}</p>
                      <p className="text-xs text-warm-500">{fu.business}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="info">{fu.type}</Badge>
                      <p className="text-xs text-warm-400 mt-1">{formatDate(fu.date)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-warm-700 mb-1">{fu.action}</p>
                  <p className="text-xs text-warm-500">{fu.notes}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Follow-Up" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Lead Name" required value={form.leadName} onChange={(e) => setForm({ ...form, leadName: e.target.value })} placeholder="Client name" />
            <Input label="Business Name" required value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} placeholder="Business name" />
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">Follow-up Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-fx">
                {followUpTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <Input label="Action" required value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} placeholder="What to do" />
            <div className="sm:col-span-2">
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
          </div>
          {form.type && (
            <div className="p-4 rounded-xl bg-fox-50 border border-fox-100">
              <p className="text-xs font-medium text-fox-700 mb-1">Suggested Message:</p>
              <p className="text-sm text-fox-600">{getSuggestedMessage(form.type)}</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">Save Follow-Up</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
