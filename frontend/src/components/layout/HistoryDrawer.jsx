import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, X, MessageSquare, Trash2, Download, Plus, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export function HistoryDrawer() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/chat/conversations');
      setConversations(res.data.conversations ?? []);
    } catch {
      toast.error('Could not load conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const deleteConv = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/chat/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      toast.success('Conversation deleted.');
    } catch {
      toast.error('Failed to delete.');
    }
  };

  const exportConv = async (conv, e) => {
    e.stopPropagation();
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/chat/conversations/${conv.id}/export`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match ? match[1] : `conversation_${conv.id}.md`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported!');
    } catch {
      toast.error('Export failed.');
    }
  };

  const openConversation = (id) => {
    navigate('/chat', { state: { conversationId: id } });
    setOpen(false);
  };

  return (
    <>
      {/* Floating history button — bottom left */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 md:bottom-6 z-40 flex items-center gap-2 px-4 py-2.5 glass rounded-2xl border border-white/20 dark:border-white/8 text-surface-600 dark:text-surface-300 hover:text-primary-500 dark:hover:text-primary-400 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 group"
        title="Conversation History"
      >
        <History className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:block">History</span>
        {conversations.length > 0 && !open && (
          <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[10px] flex items-center justify-center font-bold hidden sm:flex">
            {conversations.length > 9 ? '9+' : conversations.length}
          </span>
        )}
      </button>

      {/* Drawer backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed left-0 top-0 h-full w-80 z-50 flex flex-col glass-strong border-r border-white/10 dark:border-white/5 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200/50 dark:border-white/6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary-400" />
            <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
              Conversations
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-400 font-medium">
              {conversations.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { navigate('/chat'); setOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-gradient text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-xl text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100/50 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-14 rounded-xl bg-surface-100/50 dark:bg-white/4 animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-surface-400" />
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400">No conversations yet</p>
              <button
                onClick={() => { navigate('/chat'); setOpen(false); }}
                className="mt-3 text-sm text-primary-500 hover:text-primary-400 font-medium transition-colors"
              >
                Start your first chat →
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className="group flex items-center gap-2 px-3 py-3 rounded-xl hover:bg-primary-500/8 dark:hover:bg-primary-500/10 cursor-pointer transition-all duration-150 mb-0.5"
                onClick={() => openConversation(conv.id)}
              >
                <MessageSquare className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {new Date(conv.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => exportConv(conv, e)}
                    title="Export"
                    className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => deleteConv(conv.id, e)}
                    title="Delete"
                    className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-surface-300 dark:text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-200/50 dark:border-white/6 flex-shrink-0">
          <p className="text-xs text-surface-400 text-center">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>
    </>
  );
}
