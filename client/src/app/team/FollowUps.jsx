import { useState, useMemo } from 'react';
import { Plus, Calendar, Phone, MessageCircle, Mail, Copy, CheckCircle, Wand2, TrendingUp } from 'lucide-react';
import { Button, Input, Textarea, Select, Modal, Badge } from '@components/ui/Primitives';
import { followUpTypes, getPitch } from '@data/salesPitchLibrary';
import { cn, formatDate, formatDateTime } from '@lib/utils';
import { toast } from 'react-hot-toast';

const typeIcons = { Call: Phone, WhatsApp: MessageCircle, Email: Mail, Meeting: Calendar, Demo: Calendar };

const mockFollowUps = [
  { id: 1, leadName: 'Rajesh Kumar', business: 'Kumar Electronics', action: 'Call to discuss proposal', type: 'Call', date: '2026-08-26', time: '10:00 AM', notes: 'Discuss website pricing and timeline', completed: false, category: 'electronics' },
  { id: 2, leadName: 'Priya Sharma', business: 'Sharma Cafe', action: 'Send website mockup on WhatsApp', type: 'WhatsApp', date: '2026-08-26', time: '02:00 PM', notes: 'Send cafe website example and pricing', completed: false, category: 'cafe' },
  { id: 3, leadName: 'Amit Singh', business: 'Singh Real Estate', action: 'Schedule site visit', type: 'Meeting', date: '2026-08-26', time: '04:00 PM', notes: 'Visit property location for photos', completed: false, category: 'real-estate' },
  { id: 4, leadName: 'Neha Gupta', business: 'Gupta Clinic', action: 'Follow up on proposal', type: 'Call', date: '2026-08-27', time: '11:00 AM', notes: 'Check if they reviewed the proposal', completed: false, category: 'clinic' },
];

const baseSuggestedMessages = {
  Call: "Hi {name}, just calling to follow up on our previous conversation about {business}. Do you have 5 minutes to discuss the next steps?",
  WhatsApp: "Hi {name}, hope you're doing well. Following up on our conversation about {business}. Here is the information I promised. Let me know if you have any questions!",
  Email: "Dear {name}, I hope this email finds you well. I wanted to follow up on our discussion about {business}. Please find the attached proposal for your review.",
  Meeting: "Hi {name}, I would like to schedule a meeting to discuss {business}. Please let me know your availability this week.",
  Demo: "Hi {name}, I would like to show you a demo of how a website can benefit {business}. Are you available for a quick 15-minute demo this week?",
};

const categoryFollowUpTips = {
  'gym': 'Share a sample gym website with online trial booking. Mention how other gyms increased memberships by 30%.',
  'restaurant': 'Share a sample restaurant website with online table booking. Mention how other restaurants reduced missed bookings by 50%.',
  'cafe': 'Share a sample cafe website with menu display and ordering. Mention how cafes increased foot traffic with online presence.',
  'hotel': 'Share a sample hotel website with booking system. Mention how direct bookings save 20-25% commission.',
  'clinic': 'Share a sample clinic website with appointment booking. Mention how clinics reduced no-shows by 30% with automated reminders.',
  'hospital': 'Share a sample hospital website with department pages and online appointments. Emphasize trust and credibility.',
  'real-estate': 'Share a sample real estate website with property listings. Mention how agencies increased buyer enquiries by 25%.',
  'school': 'Share a sample school website with admission forms. Mention how schools increased admissions with online presence.',
  'car-dealer': 'Share a sample car dealer website with inventory and EMI calculator. Mention how dealers increased enquiries by 20%.',
};

export default function FollowUps() {
  const [followUps, setFollowUps] = useState(mockFollowUps);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leadName: '', business: '', action: '', type: 'Call', date: '', time: '', notes: '', category: '' });
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const todayFollowUps = followUps.filter(f => f.date === today && !f.completed);
  const upcomingFollowUps = followUps.filter(f => f.date > today && !f.completed);

  const selectedPitch = selectedFollowUp ? getPitch(selectedFollowUp.category, { name: selectedFollowUp.business }) : null;
  const categoryTip = selectedFollowUp ? categoryFollowUpTips[selectedFollowUp.category] : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFollowUps([...followUps, { ...form, id: Date.now(), completed: false }]);
    setShowModal(false);
    setForm({ leadName: '', business: '', action: '', type: 'Call', date: '', time: '', notes: '', category: '' });
    toast.success('Follow-up added!');
  };

  const toggleComplete = (id) => {
    setFollowUps(followUps.map(f => f.id === id ? { ...f, completed: !f.completed } : f));
  };

  const getSuggestedMessage = (type, leadName, business) => {
    let msg = baseSuggestedMessages[type] || baseSuggestedMessages.Call;
    msg = msg.replace('{name}', leadName || '[Name]').replace('{business}', business || '[Business]');
    if (selectedPitch && type === 'WhatsApp') {
      msg += '\n\n' + selectedPitch.whatsappPitch;
    }
    return msg;
  };

  const shareWhatsApp = (fu) => {
    const pitch = fu.category ? getPitch(fu.category, { name: fu.business }) : null;
    const text = encodeURIComponent((pitch?.whatsappPitch || 'Hi ' + fu.leadName + '!') + '\n\n' + fu.action);
    window.open('https://wa.me/?text=' + text, '_blank');
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-fox-500" />
              <h3 className="font-semibold text-warm-900">Today's Follow-ups ({todayFollowUps.length})</h3>
            </div>
            {todayFollowUps.length > 0 && (
              <span className="text-xs text-warm-500">{todayFollowUps.filter(f => !f.completed).length} pending</span>
            )}
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
                    <div className="flex items-center gap-2">
                      <button onClick={() => shareWhatsApp(fu)} className="text-xs text-success-600 hover:text-success-700 flex items-center gap-1">
                        <MessageCircle size={12} /> WhatsApp
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(getSuggestedMessage(fu.type, fu.leadName, fu.business))} className="text-xs text-fox-500 hover:text-fox-700 flex items-center gap-1">
                        <Copy size={12} /> Copy message
                      </button>
                    </div>
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
            {upcomingFollowUps.map((fu) => (
              <div key={fu.id} onClick={() => setSelectedFollowUp(fu)} className={cn('p-4 rounded-xl border cursor-pointer transition', selectedFollowUp?.id === fu.id ? 'border-fox-300 bg-fox-50' : 'border-warm-100 hover:bg-warm-50')}>
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
                {categoryTip && selectedFollowUp?.id === fu.id && (
                  <div className="mt-3 p-3 rounded-xl bg-success-50 border border-success-100">
                    <div className="flex items-center gap-1 mb-1">
                      <Wand2 size={12} className="text-success-600" />
                      <span className="text-xs font-medium text-success-700">Category Tip</span>
                    </div>
                    <p className="text-xs text-success-600">{categoryTip}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedFollowUp && selectedPitch && (
        <div className="bg-fox-50 border border-fox-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-fox-800">Smart Follow-Up for {selectedFollowUp.business}</h3>
              <p className="text-sm text-fox-600">Category: {selectedPitch.categoryName} | Status: {selectedFollowUp.status}</p>
            </div>
            <Badge variant="fox">{selectedFollowUp.type}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Suggested Message</h4>
              <div className="bg-white rounded-xl p-4 border border-fox-100">
                <p className="text-sm text-warm-700 whitespace-pre-line">{getSuggestedMessage(selectedFollowUp.type, selectedFollowUp.leadName, selectedFollowUp.business)}</p>
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(getSuggestedMessage(selectedFollowUp.type, selectedFollowUp.leadName, selectedFollowUp.business)); toast.success('Message copied!'); }}>
                <Copy size={14} /> Copy Message
              </Button>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Pitch Context</h4>
              <div className="bg-white rounded-xl p-4 border border-fox-100 space-y-2">
                <p className="text-sm text-warm-700">{selectedPitch.shortPitch}</p>
                <p className="text-xs text-warm-500">ROI: {selectedPitch.roiProjection}</p>
                <p className="text-xs text-warm-500">Quick win: {selectedPitch.quickWin}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Follow-Up" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Lead Name" required value={form.leadName} onChange={(e) => setForm({ ...form, leadName: e.target.value })} placeholder="Client name" />
            <Input label="Business Name" required value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} placeholder="Business name" />
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">Business Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-fx">
                <option value="">Select category</option>
                {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
              </select>
            </div>
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
              <p className="text-sm text-fox-600">{getSuggestedMessage(form.type, form.leadName, form.business)}</p>
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
