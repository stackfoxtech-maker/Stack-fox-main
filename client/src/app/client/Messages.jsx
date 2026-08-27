import { useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { timeAgo, getInitials, getAvatarColor } from '@lib/utils';
import { Spinner, EmptyState, Button, Input } from '@components/ui/Primitives';
import api from '@lib/api';
import useAuthStore from '@store/authStore';

export default function Messages() {
  usePageTitle('Messages');
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/messages/conversations').then((r) => setConversations(r.data.data?.conversations || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openConv = async (conv) => {
    setActiveConv(conv);
    try {
      const r = await api.get(`/messages/${conv._id}`);
      setMessages(r.data.data || []);
    } catch { setMessages([]); }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv) return;
    setSending(true);
    try {
      await api.post('/messages/send', { conversationId: activeConv._id, text: newMsg });
      setNewMsg('');
      const r = await api.get(`/messages/${activeConv._id}`);
      setMessages(r.data.data || []);
    } catch {}
    setSending(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-warm-900">Messages</h2>

      {conversations.length === 0 && !activeConv ? (
        <EmptyState icon={MessageCircle} title="No conversations" description="Messages with your project team will appear here." />
      ) : (
        <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
          {/* List */}
          <div className="w-72 shrink-0 bg-white rounded-2xl border border-warm-200 overflow-y-auto hidden md:block">
            {conversations.map((c) => {
              const other = c.participants?.find((p) => p._id !== user?.id);
              return (
                <button key={c._id} onClick={() => openConv(c)} className={`w-full text-left px-4 py-3 border-b border-warm-100 hover:bg-warm-50 transition-colors ${activeConv?._id === c._id ? 'bg-fox-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${getAvatarColor(other?.name)}`}>
                      {getInitials(other?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-warm-900 truncate">{other?.name || c.title || 'Conversation'}</p>
                      <p className="text-xs text-warm-400 truncate">{c.lastMessage?.text || 'No messages'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat */}
          <div className="flex-1 bg-white rounded-2xl border border-warm-200 flex flex-col">
            {activeConv ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const isMine = m.sender?._id === user?.id;
                    return (
                      <div key={m._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-900'}`}>
                          {!isMine && <p className="text-xs font-medium mb-0.5 opacity-70">{m.sender?.name}</p>}
                          <p className="text-sm">{m.text}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-fox-200' : 'text-warm-400'}`}>{timeAgo(m.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-warm-100 p-3 flex gap-2">
                  <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="input-fx flex-1" />
                  <Button variant="primary" size="icon" onClick={sendMessage} isLoading={sending}><Send size={18} /></Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-warm-400 text-sm">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
