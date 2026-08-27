import { useState } from 'react';
import { FileText, Download, Printer, CheckCircle } from 'lucide-react';
import { Button, Input, Textarea, Select, Badge } from '@components/ui/Primitives';
import { businessCategories } from '@data/salesPitchLibrary';

const websitePackages = [
  { id: 'basic', name: 'Basic Website', price: '₹15,000 - ₹25,000', features: ['5-7 Pages', 'Mobile Responsive', 'Contact Form', 'Google Maps', 'Basic SEO'] },
  { id: 'professional', name: 'Professional Website', price: '₹35,000 - ₹60,000', features: ['10-15 Pages', 'Advanced Design', 'Blog Section', ' enquiry Forms', 'Advanced SEO', 'Google Analytics'] },
  { id: 'enterprise', name: 'Enterprise Website', price: '₹75,000+', features: ['Unlimited Pages', 'Custom Features', 'CRM Integration', 'Advanced Analytics', 'Full SEO Package', 'Priority Support'] },
];

const seoPackages = [
  { id: 'basic-seo', name: 'Basic SEO', price: '₹5,000/month', features: ['On-Page SEO', 'Google Business Profile', 'Basic Keywords', 'Monthly Report'] },
  { id: 'advanced-seo', name: 'Advanced SEO', price: '₹12,000/month', features: ['Full On-Page SEO', 'Local SEO', 'Content Optimization', 'Link Building', 'Weekly Reports'] },
  { id: 'enterprise-seo', name: 'Enterprise SEO', price: '₹25,000/month', features: ['Full SEO Suite', 'AEO Optimization', 'Advanced Analytics', 'Dedicated Manager', 'Custom Strategy'] },
];

const marketingPackages = [
  { id: 'social', name: 'Social Media Marketing', price: '₹8,000/month' },
  { id: 'google-ads', name: 'Google Ads Management', price: '₹10,000/month' },
  { id: 'full-marketing', name: 'Full Digital Marketing', price: '₹20,000/month' },
];

export default function Proposals() {
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({
    leadName: '', businessName: '', category: '', email: '', phone: '', websitePackage: '', seoPackage: '', marketingPackage: '', timeline: '4-6 weeks', price: '', challenges: '', solution: '', notes: '',
  });

  const selectedWebsite = websitePackages.find(p => p.id === form.websitePackage);
  const selectedSEO = seoPackages.find(p => p.id === form.seoPackage);

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowPreview(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-display-sm text-warm-900">Proposals</h2>
          <p className="text-warm-500 text-sm mt-1">Create and manage client proposals</p>
        </div>
        <Button onClick={() => setShowForm(true)}><FileText size={16} /> Create Proposal</Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <h3 className="font-semibold text-warm-900 mb-4">New Proposal</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Client Name" required value={form.leadName} onChange={(e) => setForm({ ...form, leadName: e.target.value })} placeholder="Client name" />
              <Input label="Business Name" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Business name" />
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">Business Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-fx">
                  <option value="">Select category</option>
                  {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
                </select>
              </div>
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@example.com" />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">Website Package</label>
                <select value={form.websitePackage} onChange={(e) => setForm({ ...form, websitePackage: e.target.value })} className="input-fx">
                  <option value="">Select package</option>
                  {websitePackages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">SEO Package</label>
                <select value={form.seoPackage} onChange={(e) => setForm({ ...form, seoPackage: e.target.value })} className="input-fx">
                  <option value="">Select package</option>
                  {seoPackages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">Marketing Package</label>
                <select value={form.marketingPackage} onChange={(e) => setForm({ ...form, marketingPackage: e.target.value })} className="input-fx">
                  <option value="">Select package</option>
                  {marketingPackages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">Timeline</label>
                <select value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} className="input-fx">
                  <option value="2-3 weeks">2-3 Weeks</option>
                  <option value="4-6 weeks">4-6 Weeks</option>
                  <option value="6-8 weeks">6-8 Weeks</option>
                  <option value="8-12 weeks">8-12 Weeks</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Textarea label="Business Challenges" value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} placeholder="Describe the client's current challenges..." />
              </div>
              <div className="sm:col-span-2">
                <Textarea label="Proposed Solution" value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} placeholder="Describe the proposed solution..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Generate Proposal</Button>
            </div>
          </form>
        </div>
      )}

      {showPreview && (
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <div className="bg-fox-500 text-white p-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Proposal</h3>
              <p className="text-fox-100 text-sm">{form.businessName} — {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"><Printer size={18} /></button>
              <button className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"><Download size={18} /></button>
            </div>
          </div>
          <div className="p-8 space-y-8 max-w-4xl">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Client Information</h4>
                <p className="font-medium text-warm-900">{form.leadName}</p>
                <p className="text-sm text-warm-600">{form.businessName}</p>
                <p className="text-sm text-warm-500">{form.email}</p>
                <p className="text-sm text-warm-500">{form.phone}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Proposal Details</h4>
                <p className="text-sm text-warm-600">Date: {new Date().toLocaleDateString()}</p>
                <p className="text-sm text-warm-600">Valid for: 30 days</p>
                <p className="text-sm text-warm-600">Timeline: {form.timeline}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Business Challenges</h4>
              <p className="text-sm text-warm-700 leading-relaxed">{form.challenges || 'Client requires a professional digital presence to attract more customers and manage enquiries efficiently.'}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Proposed Solution</h4>
              <p className="text-sm text-warm-700 leading-relaxed">{form.solution || 'A professional website with enquiry management, SEO optimization, and marketing support.'}</p>
            </div>

            {selectedWebsite && (
              <div>
                <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Recommended Features</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedWebsite.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-warm-700">
                      <CheckCircle size={14} className="text-success-500" />{f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedWebsite && (
                <div className="p-4 rounded-xl bg-fox-50 border border-fox-100">
                  <h4 className="font-semibold text-fox-800 mb-1">Website</h4>
                  <p className="text-sm text-fox-600">{selectedWebsite.name}</p>
                  <p className="text-sm font-medium text-fox-700">{selectedWebsite.price}</p>
                </div>
              )}
              {selectedSEO && (
                <div className="p-4 rounded-xl bg-info-50 border border-info-100">
                  <h4 className="font-semibold text-info-800 mb-1">SEO</h4>
                  <p className="text-sm text-info-600">{selectedSEO.name}</p>
                  <p className="text-sm font-medium text-info-700">{selectedSEO.price}</p>
                </div>
              )}
              {form.marketingPackage && (
                <div className="p-4 rounded-xl bg-success-50 border border-success-100">
                  <h4 className="font-semibold text-success-800 mb-1">Marketing</h4>
                  <p className="text-sm text-success-600">{marketingPackages.find(p => p.id === form.marketingPackage)?.name}</p>
                  <p className="text-sm font-medium text-success-700">{marketingPackages.find(p => p.id === form.marketingPackage)?.price}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Next Steps</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-warm-700">
                <li>Review and approve the proposal</li>
                <li>Sign the agreement</li>
                <li>Make the initial payment</li>
                <li>Kick-off meeting to discuss requirements</li>
                <li>Website design and development begins</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
