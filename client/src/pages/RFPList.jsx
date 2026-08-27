import { FileText, Eye, Clock } from 'lucide-react';

const statusStyles = {
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-yellow-100 text-yellow-700',
  'Proposal Sent': 'bg-fox-500/10 text-fox-500',
  Accepted: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const mockRFPs = [
  { id: 'RFP-001', company: 'Acme Corp', industry: 'Technology', date: '2026-08-18', status: 'Proposal Sent', budget: '₹2,00,000 – ₹5,00,000' },
  { id: 'RFP-002', company: 'MediCare Plus', industry: 'Healthcare', date: '2026-08-15', status: 'Under Review', budget: '₹5,00,000 – ₹10,00,000' },
  { id: 'RFP-003', company: 'EduStart', industry: 'Education', date: '2026-08-10', status: 'Accepted', budget: '₹50,000 – ₹2,00,000' },
  { id: 'RFP-004', company: 'BuildRight', industry: 'Real Estate', date: '2026-08-05', status: 'Rejected', budget: 'Under ₹50,000' },
  { id: 'RFP-005', company: 'QuickMart', industry: 'E-Commerce', date: '2026-08-01', status: 'Submitted', budget: '₹2,00,000 – ₹5,00,000' },
];

export default function RFPList() {
  return (
    <div className="min-h-screen bg-warm-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-warm-900 flex items-center gap-3">
            <FileText className="text-fox-500" /> My RFP Submissions
          </h1>
          <a href="/rfp/submit" className="bg-fox-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-fox-600 transition">+ New RFP</a>
        </div>

        <div className="space-y-4">
          {mockRFPs.map(rfp => (
            <div key={rfp.id} className="bg-white rounded-2xl border border-warm-200 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-warm-900 truncate">{rfp.company}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[rfp.status]}`}>{rfp.status}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-warm-500">
                  <span>{rfp.id}</span>
                  <span>{rfp.industry}</span>
                  <span>{rfp.budget}</span>
                  <span className="flex items-center gap-1"><Clock size={13} /> {rfp.date}</span>
                </div>
              </div>
              <button className="flex items-center gap-1.5 text-sm font-medium text-fox-500 hover:text-fox-600 shrink-0">
                <Eye size={16} /> View Details
              </button>
            </div>
          ))}
        </div>

        {mockRFPs.length === 0 && (
          <div className="text-center py-16 text-warm-400">
            <FileText size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No RFP submissions yet</p>
            <p className="text-sm">Submit your first RFP to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
