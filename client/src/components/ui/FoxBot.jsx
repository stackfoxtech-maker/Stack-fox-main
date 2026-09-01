import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, ArrowUp } from 'lucide-react';
import { BrandLogo } from '@components/ui/BrandLogo';
import api from '@lib/api';

const QUICK_REPLIES = ['Build a website', 'Make an app', 'Need AI', 'Just exploring'];

export function FoxBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const history = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/assistant/chat', { message: trimmed, history });
      setMessages((prev) => [...prev, { role: 'bot', text: data.data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: err.response?.data?.message || "Sorry, I'm having trouble responding right now — try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {open && (
        <div
          className="mb-3 w-76 bg-white rounded-2xl border border-warm-200 shadow-[0_16px_64px_rgba(0,0,0,0.12)] p-4 animate-scale-in flex flex-col"
          style={{ width: '292px', maxHeight: '480px' }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-full bg-fox-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-fox-200">
              <BrandLogo size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-warm-900">FoxBot</div>
              <div className="text-[10px] text-warm-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Online &middot; powered by Gemini
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-lg hover:bg-warm-100 flex items-center justify-center text-warm-400 hover:text-warm-700 transition-colors"
              aria-label="Close chat"
            >
              <X size={14} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-0.5" style={{ minHeight: '120px' }}>
            {messages.length === 0 && (
              <div className="bg-fox-50 rounded-xl p-3.5 text-xs text-warm-700 border border-fox-100/50 leading-relaxed">
                <div className="flex items-center gap-1.5 mb-1 font-bold text-fox-600">
                  Hi! AI Assistant here <Sparkles size={10} />
                </div>
                I can help you pick services, estimate your project, or book a call. What are you building?
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-xs rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-fox-500 text-white ml-6' : 'bg-warm-50 text-warm-700 border border-warm-100 mr-6'
                }`}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="bg-warm-50 border border-warm-100 rounded-xl p-3 mr-6 text-xs text-warm-400">
                Thinking...
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-warm-50 border border-warm-150 text-warm-600 hover:border-fox-200 hover:text-fox-600 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask FoxBot anything..."
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-warm-200 focus:outline-none focus:ring-2 focus:ring-fox-500/30"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-8 h-8 rounded-xl bg-fox-500 text-white flex items-center justify-center hover:bg-fox-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send"
            >
              <ArrowUp size={14} />
            </button>
          </form>

          <Link to="/contact" className="text-center text-[10px] text-warm-400 hover:text-fox-500 mt-2">
            Prefer talking to a human? Book a free call
          </Link>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-fox-500 hover:bg-fox-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-[0_8px_32px_rgba(255,77,0,0.35)] active:scale-95 group"
        aria-label="Open FoxBot chat"
      >
        {open ? <X size={24} /> : <BrandLogo size={24} className="group-hover:animate-bounce" />}
      </button>
    </div>
  );
}
