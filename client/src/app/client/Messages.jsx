import { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { timeAgo, getInitials, getAvatarColor } from '@lib/utils';
import { EmptyState, Button, PanelSkeleton } from '@components/ui/Primitives';
import api from '@lib/api';
import useAuthStore from '@store/authStore';
import toast from 'react-hot-toast';

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
    api
      .get('/messages/conversations')
      .then((r) => setConversations(r.data.data?.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openConv = async (conv) => {
    setActiveConv(conv);
    try {
      const r = await api.get(`/messages/${conv._id}`);
      setMessages(r.data.data || []);
    } catch {
      setMessages([]);
    }
  };

  const [starting, setStarting] = useState(false);

  // A client cannot see the staff directory, so the server picks the recipient:
  // the project's PM, or an administrator when none is assigned.
  const startTeamConversation = async () => {
    setStarting(true);
    try {
      const r = await api.post('/messages/start-team', {});
      const conv = r.data.data;
      const list = await api.get('/messages/conversations');
      const all = list.data.data?.conversations || [];
      setConversations(all);
      await openConv(all.find((c) => c._id === conv._id) || conv);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start a conversation. Try again.');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv) return;
    setSending(true);
    try {
      await api.post('/messages/send', { conversationId: activeConv._id, text: newMsg });
      setNewMsg('');
      const r = await api.get(`/messages/${activeConv._id}`);
      setMessages(r.data.data || []);
    } catch {
      toast.error('Could not send your message. Try again.');
    }
    setSending(false);
  };

  if (loading) return <PanelSkeleton variant="list" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-warm-900">Messages</h2>
        <Button variant="primary" size="sm" onClick={startTeamConversation} disabled={starting}>
          <MessageCircle size={16} /> {starting ? 'Opening…' : 'Message your team'}
        </Button>
      </div>

      {conversations.length === 0 && !activeConv ? (
        <EmptyState
          icon={MessageCircle}
          title="No conversations"
          description="Use Message your team to reach your project manager."
        />
      ) : (
        <div className="flex h-[calc(100dvh-16rem)] min-h-[360px] gap-4 md:h-[calc(100dvh-220px)]">
          {/* List — on phones it is the whole screen until a thread is open */}
          <div
            className={`w-full shrink-0 overflow-y-auto rounded-2xl border border-warm-200 bg-white md:block md:w-72 ${activeConv ? 'hidden' : 'block'}`}
          >
            {conversations.map((c) => {
              const other = c.participants?.find((p) => p._id !== user?.id);
              return (
                <button
                  key={c._id}
                  onClick={() => openConv(c)}
                  className={`w-full min-h-[3.5rem] text-left px-4 py-3 border-b border-warm-100 hover:bg-warm-50 transition-colors ${activeConv?._id === c._id ? 'bg-fox-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${getAvatarColor(other?.name)}`}
                    >
                      {getInitials(other?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-warm-900 truncate">
                        {other?.name || c.title || 'Conversation'}
                      </p>
                      <p className="text-xs text-warm-400 truncate">
                        {c.lastMessage?.text || 'No messages'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat */}
          <div
            className={`min-w-0 flex-1 flex-col rounded-2xl border border-warm-200 bg-white md:flex ${activeConv ? 'flex' : 'hidden'}`}
          >
            {activeConv ? (
              <>
                <div className="flex items-center gap-2 border-b border-warm-100 px-2 py-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveConv(null)}
                    aria-label="Back to conversations"
                    className="grid h-10 w-10 place-items-center rounded-lg text-warm-600 hover:bg-warm-100"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <p className="truncate text-sm font-semibold text-warm-900">
                    {activeConv.participants?.find((p) => p._id !== user?.id)?.name ||
                      activeConv.title ||
                      'Conversation'}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const isMine = m.sender?._id === user?.id;
                    return (
                      <div
                        key={m._id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl md:max-w-[70%] px-4 py-2.5 ${isMine ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-900'}`}
                        >
                          {!isMine && (
                            <p className="text-xs font-medium mb-0.5 opacity-70">
                              {m.sender?.name}
                            </p>
                          )}
                          <p className="text-sm">{m.text}</p>
                          <p
                            className={`text-[10px] mt-1 ${isMine ? 'text-fox-200' : 'text-warm-400'}`}
                          >
                            {timeAgo(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-warm-100 p-3 flex gap-2">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="input-fx min-w-0 flex-1"
                  />
                  <Button variant="primary" size="icon" onClick={sendMessage} isLoading={sending}>
                    <Send size={18} />
                  </Button>
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
