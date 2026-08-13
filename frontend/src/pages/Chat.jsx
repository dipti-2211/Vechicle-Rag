import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Trash2, Download, MessageSquare, Bot, User,
  BookOpen, Loader2, AlertCircle, X, Filter, FileText,
  ThumbsUp, ThumbsDown, ChevronLeft, Sparkles, Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import api, { API_BASE_URL } from '../api/axios';
import { PromptBox } from '../components/ui/chatgpt-prompt-input';

// ─────────────────────────────────────────────────────────────────────────────
// SourceCitation
// ─────────────────────────────────────────────────────────────────────────────
function SourceCitation({ source }) {
  const pct = source.relevance_score != null ? Math.round(source.relevance_score * 100) : null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] border border-white/[0.08] text-neutral-400">
      <BookOpen className="w-2.5 h-2.5 flex-shrink-0" />
      {source.document_name}
      {pct != null && <span className="opacity-60">· {pct}%</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TypingDots
// ─────────────────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center h-5 px-1">
      {[0,1,2].map(i => (
        <span
          key={i}
          className="typing-dot w-2 h-2 rounded-full bg-neutral-500"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────────────────────────────────────────
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
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-white/10 border border-white/20'
          : 'bg-white/[0.06] border border-white/[0.1]'
      }`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white/70" />
          : <Bot className="w-3.5 h-3.5 text-neutral-400" />
        }
      </div>

      <div className={`max-w-[78%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble */}
        <div className={`px-4 py-3 text-sm leading-relaxed rounded-2xl ${
          isUser
            ? 'bg-white text-black rounded-br-sm font-medium'
            : 'bg-[#111111] border border-white/[0.08] text-neutral-200 rounded-bl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-white prose-a:text-indigo-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-white/60 ml-0.5 align-middle animate-pulse" />
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

        {/* Feedback + timestamp */}
        <div className="flex items-center gap-3 px-1">
          <p className="text-[11px] text-neutral-700">
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
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-neutral-600 hover:text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <ThumbsUp className="w-3 h-3" fill={rating === 1 ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={() => handleRate(-1)}
                disabled={isRating}
                title="Not helpful"
                className={`p-1 rounded-md transition-all ${
                  rating === -1
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-neutral-600 hover:text-red-400 hover:bg-red-500/10'
                }`}
              >
                <ThumbsDown className="w-3 h-3" fill={rating === -1 ? 'currentColor' : 'none'} />
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

  useEffect(() => {
    const convId = location.state?.conversationId;
    if (convId) {
      selectConversation(convId);
      setSidebarOpen(true);
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectConversation = useCallback((convId) => {
    setActiveConvId(convId);
    loadMessages(convId);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, [loadMessages]);

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

  // ── Send ──────────────────────────────────────────────────
  const sendMessage = async (directMsg) => {
    const q = (directMsg ?? question).trim();
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
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
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
        const detail = fallbackErr.response?.data?.detail ?? fallbackErr.message ?? 'Failed to get a response.';
        toast.error(detail);
        setQuestion(q);
      }
    } finally {
      setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const activeConvTitle = activeConvId
    ? conversations.find(c => c.id === activeConvId)?.title ?? 'Chat'
    : 'New Conversation';

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#050505] overflow-hidden">

      {/* ── Sidebar Backdrop ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Conversation Sidebar ──────────────────────────────────────── */}
      <aside className={`
        flex-shrink-0 flex flex-col bg-[#0a0a0a] border-r border-white/[0.06]
        fixed lg:relative top-16 lg:top-0 h-[calc(100%-4rem)] lg:h-full z-30
        transition-all duration-300 ease-out
        ${sidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full lg:w-0 lg:overflow-hidden'}
      `}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-medium text-neutral-300">Conversations</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={newConversation}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.1] transition-all"
            >
              <Plus className="w-3 h-3" /> New
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 lg:hidden">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loadingConvs ? (
            <div className="space-y-1.5 p-2">
              {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-6 h-6 text-neutral-700 mb-2" />
              <p className="text-xs text-neutral-600">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => selectConversation(conv.id)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && selectConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 rounded-lg group transition-all duration-150 mb-0.5 cursor-pointer ${
                  activeConvId === conv.id
                    ? 'bg-white/[0.08] border border-white/[0.1] text-white'
                    : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="text-xs truncate flex-1">{conv.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${conv.id}/export`);
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
                    className="p-1 rounded text-neutral-600 hover:text-indigo-400 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => deleteConversation(conv.id, e)}
                    title="Delete"
                    className="p-1 rounded text-neutral-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Chat top bar */}
        <div className="h-14 px-4 bg-[#050505] border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.06] transition-all"
            title="Toggle conversations"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>

          {/* Conversation title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <Zap className="w-3 h-3 text-neutral-400" />
            </div>
            <span className="text-sm font-medium text-neutral-300 truncate">{activeConvTitle}</span>
          </div>

          {/* New conversation button */}
          <button
            onClick={newConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-white border border-transparent hover:border-white/[0.08] hover:bg-white/[0.04] transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>

          {/* Document scope selector */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setScopeOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                selectedDocIds.length > 0
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                  : 'border-white/[0.08] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.15]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {selectedDocIds.length > 0 ? `${selectedDocIds.length} doc${selectedDocIds.length > 1 ? 's' : ''}` : 'All Docs'}
            </button>

            {scopeOpen && readyDocs.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#111111] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Scope Search To</span>
                  {selectedDocIds.length > 0 && (
                    <button onClick={() => setSelectedDocIds([])} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Clear</button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {readyDocs.map(doc => (
                    <label key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                          else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-transparent accent-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-200 truncate">{doc.original_filename}</p>
                        <p className="text-xs text-neutral-600">{doc.chunk_count} chunks</p>
                      </div>
                      <FileText className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                    </label>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-white/[0.06]">
                  <button onClick={() => setScopeOpen(false)} className="w-full py-2 text-xs font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-all">
                    Apply
                  </button>
                </div>
              </div>
            )}
            {scopeOpen && <div className="fixed inset-0 z-40" onClick={() => setScopeOpen(false)} />}
          </div>

          {docCount === 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              No docs
            </div>
          )}
        </div>

        {/* ── Messages area ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 bg-[#050505]">
          {loadingMsgs ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-600" />
            </div>
          ) : messages.length === 0 ? (

            /* ── Empty / Welcome state ──────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fade-in max-w-lg mx-auto">

              {/* Icon — same as navbar logo */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center shadow-2xl">
                <Zap className="w-8 h-8 text-white" />
              </div>

              {/* Heading */}
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  How Can I Assist you today?
                </h2>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-sm">
                  Ask me anything about your uploaded vehicle documents — manuals, maintenance logs, or inspection reports.
                </p>
              </div>

              {/* No docs warning */}
              {docCount === 0 && (
                <div className="bento-card px-4 py-3 flex items-start gap-3 max-w-sm w-full text-left"
                  style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-neutral-400">
                    No documents indexed yet.{' '}
                    <button onClick={() => navigate('/upload')} className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-medium transition-colors">
                      Upload one first.
                    </button>
                  </div>
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
                  <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="bg-[#111111] border border-white/[0.08] px-4 py-3 rounded-2xl rounded-bl-sm">
                    <TypingDots />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── PromptBox input ─────────────────────────────────────────────── */}
        <div className="px-4 md:px-8 pb-4 pt-3 bg-[#050505] border-t border-white/[0.06] flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <PromptBox
              ref={inputRef}
              externalValue={question}
              onExternalChange={setQuestion}
              onSend={(msg) => sendMessage(msg)}
              isSending={isSending}
              placeholder={docCount > 0 ? 'Ask a question about your vehicles…' : 'Upload documents first to start chatting…'}
              disabled={isSending}
            />
            <p className="text-[11px] text-neutral-700 text-center mt-2 select-none">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
