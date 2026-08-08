import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Send, Plus, Trash2, Download, MessageSquare, Bot, User,
  BookOpen, Loader2, AlertCircle, X, Filter, FileText,
  ThumbsUp, ThumbsDown, Zap, Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import api from '../api/axios';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SourceCitation({ source }) {
  const pct = source.relevance_score != null ? Math.round(source.relevance_score * 100) : null;
  return (
    <span className="source-chip">
      <BookOpen className="w-3 h-3 flex-shrink-0" />
      {source.document_name}
      {pct != null && <span className="opacity-60">· {pct}%</span>}
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center h-5 px-1">
      {[0,1,2].map(i => (
        <span
          key={i}
          className="typing-dot w-2 h-2 rounded-full bg-primary-400"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message, onRate }) {
  const isUser      = message.role === 'user';
  const isStreaming = message.isStreaming ?? false;
  const [rating, setRating]   = useState(message.rating ?? null);
  const [isRating, setIsRating] = useState(false);

  const handleRate = async (value) => {
    if (isRating || isStreaming) return;
    const newRating = rating === value ? null : value;
    setRating(newRating);
    setIsRating(true);
    try {
      await api.patch(`/api/chat/messages/${message.id}/rating`, { rating: newRating });
      onRate?.(message.id, newRating);
    } catch {
      setRating(rating);
    } finally {
      setIsRating(false);
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end group animate-slide-up`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
        isUser
          ? 'bg-gradient-to-br from-primary-500 to-primary-700'
          : 'bg-gradient-to-br from-accent-500 to-primary-600'
      }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      <div className={`max-w-[78%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble */}
        <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser ? 'bubble-user' : 'bubble-assistant'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-primary-400 ml-0.5 align-middle animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Source citations */}
        {!isUser && message.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.sources.map((src, i) => (
              <SourceCitation key={i} source={src} />
            ))}
          </div>
        )}

        {/* Feedback + timestamp row */}
        <div className="flex items-center gap-3 px-1">
          <p className="text-xs text-surface-400">
            {message.created_at
              ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </p>
          {!isUser && !isStreaming && message.id && !message.id.startsWith('temp') && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => handleRate(1)}
                disabled={isRating}
                title="Helpful"
                className={`p-1 rounded-md transition-all ${
                  rating === 1
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : 'text-surface-400 hover:text-emerald-500 hover:bg-emerald-500/10'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" fill={rating === 1 ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={() => handleRate(-1)}
                disabled={isRating}
                title="Not helpful"
                className={`p-1 rounded-md transition-all ${
                  rating === -1
                    ? 'text-danger-400 bg-danger-500/10'
                    : 'text-surface-400 hover:text-danger-400 hover:bg-danger-500/10'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" fill={rating === -1 ? 'currentColor' : 'none'} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Chat() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId]   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [question, setQuestion]           = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [docCount, setDocCount]           = useState(0);
  const [readyDocs, setReadyDocs]         = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [scopeOpen, setScopeOpen]         = useState(false);

  // ── Init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [convsRes, docsRes] = await Promise.all([
          api.get('/api/chat/conversations'),
          api.get('/api/documents?status=ready'),
        ]);
        setConversations(convsRes.data.conversations ?? []);
        const docs = docsRes.data.documents ?? [];
        setDocCount(docs.length);
        setReadyDocs(docs);
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setLoadingConvs(false);
      }
    };
    init();
  }, []);

  // Open conversation from location state (from HistoryDrawer)
  useEffect(() => {
    const convId = location.state?.conversationId;
    if (convId) {
      selectConversation(convId);
      setSidebarOpen(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const res = await api.get(`/api/chat/conversations/${convId}/messages`);
      setMessages(res.data.messages ?? []);
    } catch {
      toast.error('Failed to load messages.');
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const selectConversation = (convId) => {
    setActiveConvId(convId);
    loadMessages(convId);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setQuestion('');
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const deleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/chat/conversations/${convId}`);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) { setActiveConvId(null); setMessages([]); }
      toast.success('Conversation deleted.');
    } catch {
      toast.error('Failed to delete conversation.');
    }
  };

  // ── Send ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const q = question.trim();
    if (!q || isSending) return;

    setQuestion('');
    setIsSending(true);

    const tempUserMsgId = `temp-user-${Date.now()}`;
    const tempAsstMsgId = `temp-asst-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: tempUserMsgId, role: 'user', content: q, sources: [], created_at: new Date().toISOString(), conversation_id: activeConvId ?? '' },
      { id: tempAsstMsgId, role: 'assistant', content: '', sources: [], created_at: new Date().toISOString(), conversation_id: activeConvId ?? '', isStreaming: true },
    ]);

    let streamedConvId = activeConvId;

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          conversation_id: activeConvId,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let payload;
          try { payload = JSON.parse(raw); } catch { continue; }

          if (payload.token !== undefined) {
            setMessages(prev => prev.map(m =>
              m.id === tempAsstMsgId ? { ...m, content: m.content + payload.token } : m
            ));
          } else if (payload.done) {
            setMessages(prev => prev.map(m =>
              m.id === tempAsstMsgId
                ? { ...m, content: payload.full_answer, sources: payload.sources ?? [], isStreaming: false }
                : m
            ));
          } else if (payload.saved) {
            streamedConvId = payload.conversation_id;
            setMessages(prev => prev.map(m =>
              m.id === tempAsstMsgId
                ? { ...m, id: payload.message_id, isStreaming: false, conversation_id: streamedConvId }
                : m.id === tempUserMsgId
                  ? { ...m, id: `user-${Date.now()}` }
                  : m
            ));
            if (!activeConvId) {
              setActiveConvId(streamedConvId);
              const convsRes = await api.get('/api/chat/conversations');
              setConversations(convsRes.data.conversations ?? []);
            }
          } else if (payload.error) {
            throw new Error(payload.error);
          }
        }
      }
    } catch (err) {
      console.warn('Stream failed, falling back to /ask:', err.message);
      try {
        const res = await api.post('/api/chat/ask', {
          question: q,
          conversation_id: activeConvId,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        });
        const { answer, sources, conversation_id, message_id } = res.data;
        if (!activeConvId) {
          setActiveConvId(conversation_id);
          const convsRes = await api.get('/api/chat/conversations');
          setConversations(convsRes.data.conversations ?? []);
        }
        setMessages(prev => {
          const base = prev.filter(m => m.id !== tempUserMsgId && m.id !== tempAsstMsgId);
          return [
            ...base,
            { id: `user-${Date.now()}`, role: 'user', content: q, sources: [], created_at: new Date().toISOString(), conversation_id },
            { id: message_id, role: 'assistant', content: answer, sources: sources ?? [], created_at: new Date().toISOString(), conversation_id },
          ];
        });
      } catch (fallbackErr) {
        setMessages(prev => prev.filter(m => m.id !== tempUserMsgId && m.id !== tempAsstMsgId));
        const detail = fallbackErr.response?.data?.detail ?? 'Failed to get a response.';
        toast.error(detail);
        setQuestion(q);
      }
    } finally {
      setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Conversation Sidebar ─────────────────────────────────────── */}
      {/* Backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        flex-shrink-0 flex flex-col
        glass-strong border-r border-white/8 dark:border-white/5
        fixed lg:relative top-16 lg:top-0 h-[calc(100%-4rem)] lg:h-full z-30
        transition-all duration-300 ease-out
        ${sidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full lg:w-0 lg:overflow-hidden'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary-400" />
            <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-100">Conversations</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={newConversation}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg btn-gradient text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 lg:hidden">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
          {loadingConvs ? (
            <div className="space-y-2 p-2">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-surface-100/50 dark:bg-white/4 animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-surface-300 dark:text-surface-600 mb-2" />
              <p className="text-xs text-surface-400">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full text-left px-3 py-3 flex items-center gap-2 rounded-xl group transition-all duration-150 mb-0.5 ${
                  activeConvId === conv.id ? 'nav-active' : 'hover:bg-surface-100/50 dark:hover:bg-white/4'
                }`}
              >
                <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConvId === conv.id ? 'text-primary-400' : 'text-surface-400'}`} />
                <span className={`text-sm truncate flex-1 ${activeConvId === conv.id ? 'text-primary-300 font-medium' : 'text-surface-600 dark:text-surface-300'}`}>
                  {conv.title}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const apiBase = import.meta.env.VITE_API_URL || '';
                        const res = await fetch(`${apiBase}/api/chat/conversations/${conv.id}/export`);
                        if (!res.ok) throw new Error();
                        const blob = await res.blob();
                        const d = res.headers.get('Content-Disposition') || '';
                        const match = d.match(/filename="(.+?)"/);
                        const name = match ? match[1] : `conversation_${conv.id}.md`;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Exported!');
                      } catch { toast.error('Export failed.'); }
                    }}
                    title="Export"
                    className="p-1 rounded text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => deleteConversation(conv.id, e)}
                    title="Delete"
                    className="p-1 rounded text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Chat Header */}
        <div className="h-14 px-4 glass border-b border-white/8 dark:border-white/5 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100/50 dark:hover:bg-white/5 transition-all"
            title="Toggle conversations"
          >
            <MessageSquare className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-500 to-primary-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm truncate">
              {activeConvId
                ? conversations.find(c => c.id === activeConvId)?.title ?? 'Chat'
                : 'New Conversation'}
            </span>
          </div>

          {/* Document scope selector */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setScopeOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                selectedDocIds.length > 0
                  ? 'nav-active'
                  : 'glass border-white/10 dark:border-white/6 text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {selectedDocIds.length > 0 ? `${selectedDocIds.length} doc${selectedDocIds.length > 1 ? 's' : ''}` : 'All Docs'}
            </button>

            {scopeOpen && readyDocs.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-72 glass-strong rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 dark:border-white/6 animate-scale-in">
                <div className="px-4 py-3 border-b border-surface-200/40 dark:border-white/6 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">Scope Search To</span>
                  {selectedDocIds.length > 0 && (
                    <button onClick={() => setSelectedDocIds([])} className="text-xs text-primary-400 hover:text-primary-300 font-medium">Clear</button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {readyDocs.map(doc => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50/40 dark:hover:bg-white/4 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                          else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                        }}
                        className="w-4 h-4 rounded border-surface-300 text-primary-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-800 dark:text-surface-200 truncate">{doc.original_filename}</p>
                        <p className="text-xs text-surface-400">{doc.chunk_count} chunks</p>
                      </div>
                      <FileText className="w-3.5 h-3.5 text-surface-300 dark:text-surface-600 flex-shrink-0" />
                    </label>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-surface-200/40 dark:border-white/6">
                  <button
                    onClick={() => setScopeOpen(false)}
                    className="w-full py-1.5 text-xs font-semibold btn-gradient rounded-xl"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
            {scopeOpen && <div className="fixed inset-0 z-40" onClick={() => setScopeOpen(false)} />}
          </div>

          {docCount === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-warning-500/10 border border-warning-500/20 text-warning-500 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              No docs
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {loadingMsgs ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            </div>
          ) : messages.length === 0 ? (
            /* Welcome state */
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl btn-gradient flex items-center justify-center shadow-2xl shadow-primary-500/40">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-surface-900 dark:text-white">
                  Vehicle Intelligence
                </h2>
                <p className="text-surface-500 dark:text-surface-400 mt-2 max-w-sm text-sm leading-relaxed">
                  Ask me anything about your uploaded vehicle documents — manuals, maintenance logs, or inspection reports.
                </p>
              </div>

              {docCount === 0 ? (
                <div className="glass rounded-2xl p-4 border border-warning-500/20 text-sm text-warning-600 dark:text-warning-400 max-w-sm flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    No documents indexed yet.{' '}
                    <button onClick={() => navigate('/upload')} className="underline font-semibold text-warning-500">
                      Upload one first.
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
                  {[
                    'What is the recommended oil change interval?',
                    'What are the tire pressure specifications?',
                    'When should brake pads be replaced?',
                    'What type of coolant is required?',
                  ].map(sample => (
                    <button
                      key={sample}
                      onClick={() => { setQuestion(sample); inputRef.current?.focus(); }}
                      className="prompt-chip"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} onRate={() => {}} />
              ))}
              {isSending && !messages.some(m => m.isStreaming) && (
                <div className="flex gap-3 items-end animate-slide-up">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-500 to-primary-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bubble-assistant px-4 py-3">
                    <TypingDots />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="px-4 pb-4 pt-3 border-t border-white/8 dark:border-white/5 glass flex-shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={docCount > 0 ? 'Ask a question about your vehicles…' : 'Upload documents first…'}
                disabled={isSending}
                rows={1}
                className="w-full px-4 py-3 pr-10 rounded-2xl border border-surface-200/60 dark:border-white/8 bg-surface-100/60 dark:bg-white/5 text-surface-900 dark:text-surface-100 placeholder-surface-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-transparent transition-all leading-snug disabled:opacity-60 backdrop-blur-sm"
                style={{ minHeight: '48px', maxHeight: '140px' }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                }}
              />
              {question && (
                <button
                  onClick={() => setQuestion('')}
                  className="absolute right-3 top-3.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!question.trim() || isSending}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl btn-gradient shadow-lg shadow-primary-500/30 transition-all"
            >
              {isSending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
            </button>
          </div>
          <p className="text-xs text-surface-400 text-center mt-2">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
