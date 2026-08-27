import { useState, useMemo } from 'react';
import { FileText, Download, Printer, CheckCircle, Wand2, MessageCircle, Share2, Sparkles } from 'lucide-react';
import { Button, Input, Textarea, Select, Badge } from '@components/ui/Primitives';
import { businessCategories, getPitch } from '@data/salesPitchLibrary';
import { toast } from 'react-hot-toast';

const websitePackages = [
  { id: 'basic', name: 'Basic Website', price: '₹15,000 - ₹25,000', features: ['5-7 Pages', 'Mobile Responsive', 'Contact Form', 'Google Maps', 'Basic SEO'] },
  { id: 'professional', name: 'Professional Website', price: '₹35,000 - ₹60,000', features: ['10-15 Pages', 'Advanced Design', 'Blog Section', 'Enquiry Forms', 'Advanced SEO', 'Google Analytics'] },
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

const categoryRecommendations = {
  'gym': { website: 'professional', seo: 'advanced-seo', marketing: 'social', reason: 'Gyms need online booking and class schedules to capture trial enquiries.' },
  'restaurant': { website: 'professional', seo: 'advanced-seo', marketing: 'social', reason: 'Restaurants need menu display, table booking, and local SEO for "near me" searches.' },
  'cafe': { website: 'professional', seo: 'advanced-seo', marketing: 'social', reason: 'Cafes need ambiance photos, menu display, and Instagram integration for foot traffic.' },
  'hotel': { website: 'enterprise', seo: 'advanced-seo', marketing: 'google-ads', reason: 'Hotels need booking system, room showcase, and Google Ads for direct bookings.' },
  'clinic': { website: 'professional', seo: 'advanced-seo', marketing: 'google-ads', reason: 'Clinics need appointment booking, service pages, and local SEO for patient enquiries.' },
  'hospital': { website: 'enterprise', seo: 'advanced-seo', marketing: 'google-ads', reason: 'Hospitals need comprehensive information, department pages, and trust-building features.' },
  'real-estate': { website: 'enterprise', seo: 'advanced-seo', marketing: 'google-ads', reason: 'Real estate needs property listings, virtual tours, and advanced search for serious buyers.' },
  'school': { website: 'professional', seo: 'advanced-seo', marketing: 'social', reason: 'Schools need admission forms, faculty profiles, and result showcase for parents.' },
  'car-dealer': { website: 'enterprise', seo: 'advanced-seo', marketing: 'google-ads', reason: 'Car dealers need inventory catalog, EMI calculator, and lead capture for buyers.' },
};

export default function Proposals() {
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({
    leadName: '', businessName: '', category: '', email: '', phone: '', websitePackage: '', seoPackage: '', marketingPackage: '', timeline: '4-6 weeks', price: '', challenges: '', solution: '', notes: '',
  });
  const [pitchInserted, setPitchInserted] = useState(false);

  const selectedWebsite = websitePackages.find(p => p.id === form.websitePackage);
  const selectedSEO = seoPackages.find(p => p.id === form.seoPackage);
  const pitch = form.category ? getPitch(form.category) : null;
  const recommendation = form.category ? categoryRecommendations[form.category] : null;

  const applyRecommendation = () => {
    if (!recommendation) return;
    setForm({
      ...form,
      websitePackage: recommendation.website,
      seoPackage: recommendation.seo,
      marketingPackage: recommendation.marketing,
      solution: pitch?.mainPitch || form.solution,
    });
    setPitchInserted(true);
    toast.success('Category-specific recommendation applied!');
  };

  const insertPitch = () => {
    if (!pitch) return;
    setForm({
      ...form,
      solution: pitch.mainPitch,
      challenges: pitch.commonProblems.slice(0, 2).join('. ') + '.',
    });
    setPitchInserted(true);
    toast.success('Pitch inserted into proposal!');
  };

  const shareWhatsApp = () => {
    if (!pitch) return;
    const text = encodeURIComponent('Proposal for ' + form.businessName + '\n\n' + pitch.shortPitch + '\n\nWebsite: ' + (selectedWebsite?.name || 'TBD') + '\nSEO: ' + (selectedSEO?.name || 'TBD') + '\n\n' + pitch.mainPitch);
    window.open('https://wa.me/?text=' + text, '_blank');
  };

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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-900">New Proposal</h3>
            {recommendation && (
              <Button variant="outline" onClick={applyRecommendation} className="text-xs">
                <Sparkles size={14} /> Apply Smart Recommendation
              </Button>
            )}
          </div>

          {recommendation && (
            <div className="bg-info-50 border border-info-100 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-info-700">Recommended for {businessCategories.find(c => c.id === form.category)?.name}:</p>
              <p className="text-sm text-info-600 mt-1">{recommendation.reason}</p>
              <p className="text-xs text-info-500 mt-1">Website: {recommendation.website} | SEO: {recommendation.seo} | Marketing: {recommendation.marketing}</p>
            </div>
          )}

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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-warm-700">Business Challenges</label>
                  {pitch && (
                    <button type="button" onClick={insertPitch} className="text-xs text-fox-500 hover:text-fox-700 flex items-center gap-1">
                      <Wand2 size={12} /> Auto-fill from pitch
                    </button>
                  )}
                </div>
                <Textarea value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} placeholder="Describe the client's current challenges..." />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-warm-700 mb-1.5">Proposed Solution</label>
                <Textarea value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} placeholder="Describe the proposed solution..." />
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
              <button onClick={shareWhatsApp} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"><MessageCircle size={18} /></button>
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

            {pitch && (
              <div className="bg-fox-50 border border-fox-100 rounded-xl p-5">
                <h4 className="text-xs font-semibold text-fox-700 uppercase tracking-wide mb-2">Personalized Pitch</h4>
                <p className="text-sm text-warm-700 leading-relaxed">{pitch.mainPitch}</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-warm-500 mb-1">ROI Projection</p>
                    <p className="text-sm text-warm-700">{pitch.roiProjection}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-warm-500 mb-1">Quick Win</p>
                    <p className="text-sm text-warm-700">{pitch.quickWin}</p>
                  </div>
                </div>
              </div>
            )}

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

            {pitch && (
              <div className="bg-success-50 border border-success-100 rounded-xl p-5">
                <h4 className="text-xs font-semibold text-success-700 uppercase tracking-wide mb-2">Why This Works for {pitch.categoryName}</h4>
                <p className="text-sm text-warm-700 leading-relaxed mb-3">{pitch.competitorAdvantage}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-warm-500 mb-1">Expected Result</p>
                    <p className="text-sm text-warm-700">{pitch.roiProjection}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-warm-500 mb-1">Immediate Action</p>
                    <p className="text-sm text-warm-700">{pitch.quickWin}</p>
                  </div>
                </div>
              </div>
            )}

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
