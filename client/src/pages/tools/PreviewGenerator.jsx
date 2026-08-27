import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Share2, Twitter, Facebook, Linkedin } from 'lucide-react';

const platforms = [
  { id: 'twitter', label: 'Twitter / X', icon: Twitter, cardClass: 'max-w-[500px]' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, cardClass: 'max-w-[524px]' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, cardClass: 'max-w-[552px]' },
];

function PreviewCard({ platform, title, desc, url }) {
  return (
    <div className={`bg-white rounded-2xl border border-warm-200 p-6 ${platform.cardClass}`}>
      <div className="flex items-center gap-2 mb-4">
        <platform.icon className="w-5 h-5 text-warm-500" />
        <span className="text-sm font-medium text-warm-700">{platform.label}</span>
      </div>
      <div className="border border-warm-200 rounded-xl overflow-hidden">
        <div className="bg-warm-100 h-40 flex items-center justify-center text-warm-400 text-sm">OG Image Preview</div>
        <div className="p-4">
          <p className="text-xs text-warm-400 uppercase tracking-wide mb-1">{url || 'example.com'}</p>
          <h4 className="font-semibold text-warm-900 text-sm leading-snug mb-1">{title || 'Your Page Title'}</h4>
          <p className="text-xs text-warm-500 line-clamp-2">{desc || 'A brief description of your page will appear here. This is the meta description tag content.'}</p>
        </div>
      </div>
    </div>
  );
}

export default function PreviewGenerator() {
  usePageTitle('Social Preview Generator');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [active, setActive] = useState('twitter');

  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <Share2 className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">Social Preview Generator</h1>
        <p className="text-warm-600">See how your link looks when shared on social media.</p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6 mb-8 space-y-3">
        <input placeholder="https://yoursite.com/page" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full border border-warm-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500" />
        <input placeholder="Page Title (og:title)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-warm-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500" />
        <textarea placeholder="Description (og:description)" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="w-full border border-warm-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500 resize-none" />
      </div>

      <div className="flex gap-2 mb-6">
        {platforms.map((p) => (
          <button key={p.id} onClick={() => setActive(p.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition ${active === p.id ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'}`}>
            <p.icon className="w-4 h-4" /> {p.label}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <PreviewCard platform={platforms.find((p) => p.id === active)} title={title} desc={desc} url={url} />
      </div>
    </div>
  );
}
