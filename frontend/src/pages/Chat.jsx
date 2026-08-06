import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Plus,
  Trash2,
  Download,
  MessageSquare,
  Bot,
  User,
  BookOpen,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  Filter,
  FileText,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import api from '../api/axios';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SourceCitation({ source }) {
  const pct = source.relevance_score != null
    ? Math.round(source.relevance_score * 100)
    : null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
      <BookOpen className="w-3 h-3 flex-shrink-0" />
      {source.document_name}
      {pct != null && <span className="opacity-60">· {pct}%</span>}
    </span>
  );
}

function MessageBubble({ message, onRate }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming ?? false;
  const [rating, setRating] = useState(message.rating ?? null);
  const [isRating, setIsRating] = useState(false);

  const handleRate = async (value) => {
    if (isRating || isStreaming) return;
    // Toggle off if clicking same rating
    const newRating = rating === value ? null : value;
    setRating(newRating);  // Optimistic update
    setIsRating(true);
    try {
      await api.patch(`/api/chat/messages/${message.id}/rating`, { rating: newRating });
      onRate?.(message.id, newRating);
    } catch {
      setRating(rating); // Revert on error
    } finally {
      setIsRating(false);
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start group`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-primary-600 text-white'
          : 'bg-gradient-to-br from-accent-500 to-primary-600 text-white'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`max-w-[75%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            /* Empty streaming placeholder — show bouncing dots */
            <div className="flex gap-1 items-center h-5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-surface-400"
                  style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {/* Blinking cursor while streaming */}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-primary-500 ml-0.5 align-middle animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Source citations */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((src, i) => (
              <SourceCitation key={i} source={src} />
            ))}
          </div>
        )}

        {/* Thumbs feedback + timestamp row */}
        <div className="flex items-center gap-3 px-1">
          <p className="text-xs text-surface-400">
            {message.created_at
              ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </p>

          {/* Feedback buttons — only on finished assistant messages */}
          {!isUser && !isStreaming && message.id && !message.id.startsWith('temp') && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => handleRate(1)}
                disabled={isRating}
                title="Helpful"
                className={`p-1 rounded-md transition-all ${
                  rating === 1
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                    : 'text-surface-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-100 dark:hover:bg-surface-700'
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
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30'
                    : 'text-surface-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-100 dark:hover:bg-surface-700'
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

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent-500 to-primary-600 text-white flex items-center justify-center">
        <Bot className="w-4 h-4" />
      </div>
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-surface-400"
              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Chat() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // State
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId]   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [question, setQuestion]           = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [docCount, setDocCount]           = useState(0);
  const [readyDocs, setReadyDocs]         = useState([]);  // all ready docs for scope selector
  const [selectedDocIds, setSelectedDocIds] = useState([]); // [] = search all
  const [scopeOpen, setScopeOpen]         = useState(false); // scope dropdown open

  // ── Load conversations + doc count on mount ───────────────────────
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
        console.error('Failed to load chat init data:', err);
      } finally {
        setLoadingConvs(false);
      }
    };
    init();
  }, []);

  // ── Scroll to bottom on new messages ─────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // ── Load messages when conversation changes ───────────────────────
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const res = await api.get(`/api/chat/conversations/${convId}/messages`);
      setMessages(res.data.messages ?? []);
    } catch (err) {
      console.error('Failed to load messages:', err);
      toast.error('Failed to load conversation messages.');
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const selectConversation = (convId) => {
    setActiveConvId(convId);
    loadMessages(convId);
    inputRef.current?.focus();
  };

  // ── New conversation ──────────────────────────────────────────────
  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setQuestion('');
    inputRef.current?.focus();
  };

  // ── Delete conversation ───────────────────────────────────────────
  const deleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/chat/conversations/${convId}`);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
      toast.success('Conversation deleted.');
    } catch {
      toast.error('Failed to delete conversation.');
    }
  };

  // ── Send message (streaming) ──────────────────────────────────────
  const sendMessage = async () => {
    const q = question.trim();
    if (!q || isSending) return;

    setQuestion('');
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const tempAsstMsgId = `temp-asst-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      {
        id: tempUserMsgId,
        role: 'user',
        content: q,
        sources: [],
        created_at: new Date().toISOString(),
        conversation_id: activeConvId ?? '',
      },
      // Placeholder assistant message — tokens stream into this
      {
        id: tempAsstMsgId,
        role: 'assistant',
        content: '',           // starts empty
        sources: [],
        created_at: new Date().toISOString(),
        conversation_id: activeConvId ?? '',
        isStreaming: true,     // custom flag for cursor display
      },
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE lines are separated by \n\n
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? ''; // last incomplete line stays in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let payload;
          try { payload = JSON.parse(raw); } catch { continue; }

          if (payload.token !== undefined) {
            // Append token to assistant message
            setMessages(prev => prev.map(m =>
              m.id === tempAsstMsgId
                ? { ...m, content: m.content + payload.token }
                : m
            ));
          } else if (payload.done) {
            // Full answer + sources received
            setMessages(prev => prev.map(m =>
              m.id === tempAsstMsgId
                ? { ...m, content: payload.full_answer, sources: payload.sources ?? [] }
                : m
            ));
          } else if (payload.saved) {
            // DB save confirmed — update temp ID to real message ID
            const realMsgId = payload.message_id;
            streamedConvId = payload.conversation_id;
            setMessages(prev => prev.map(m =>
              m.id === tempAsstMsgId
                ? { ...m, id: realMsgId, isStreaming: false, conversation_id: streamedConvId }
                : m.id === tempUserMsgId
                  ? { ...m, id: `user-${Date.now()}` }
                  : m
            ));
            // Update conversation list if this was a new conversation
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
      // ── Fallback: non-streaming /api/chat/ask ────────────────────
      console.warn('Streaming failed, falling back to /api/chat/ask:', err.message);
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
          const withoutTemps = prev.filter(m => m.id !== tempUserMsgId && m.id !== tempAsstMsgId);
          return [
            ...withoutTemps,
            { id: `user-${Date.now()}`, role: 'user', content: q, sources: [], created_at: new Date().toISOString(), conversation_id: conversation_id },
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
      // Clear the streaming flag from the assistant message (in case of error path)
      setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
      setIsSending(false);
      inputRef.current?.focus();
    }

  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-0px)] -m-4 md:-m-6 overflow-hidden">

      {/* ── Conversation Sidebar ──────────────────────────────────── */}
      <aside className={`
        flex-shrink-0 w-72 flex flex-col
        bg-white dark:bg-surface-900
        border-r border-surface-200 dark:border-surface-800
        transition-all duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full w-0 overflow-hidden'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">Conversations</h2>
          <button
            onClick={newConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto py-2">
          {loadingConvs ? (
            <div className="space-y-2 p-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 rounded-lg bg-surface-100 dark:bg-surface-800 animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 px-4 text-sm text-surface-400">
              No conversations yet.<br />Ask your first question!
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-2 group hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                  activeConvId === conv.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                  activeConvId === conv.id
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-surface-400'
                }`} />
                <span className={`text-sm truncate flex-1 ${
                  activeConvId === conv.id
                    ? 'text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-surface-700 dark:text-surface-300'
                }`}>
                  {conv.title}
                </span>

                {/* Export button */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const apiBase = import.meta.env.VITE_API_URL || '';
                      const res = await fetch(`${apiBase}/api/chat/conversations/${conv.id}/export`);
                      if (!res.ok) throw new Error('Export failed');
                      const blob = await res.blob();
                      const disposition = res.headers.get('Content-Disposition') || '';
                      const match = disposition.match(/filename="(.+?)"/);
                      const filename = match ? match[1] : `conversation_${conv.id}.md`;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = filename; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Conversation exported!');
                    } catch {
                      toast.error('Export failed.');
                    }
                  }}
                  title="Export as Markdown"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-surface-400 hover:text-danger-500 transition-all"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat Header */}
        <div className="h-14 px-4 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-500" />
            <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
              {activeConvId
                ? conversations.find(c => c.id === activeConvId)?.title ?? 'Chat'
                : 'New Conversation'}
            </span>
          </div>

          {/* Document Scope Selector */}
          <div className="ml-auto relative">
            <button
              onClick={() => setScopeOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedDocIds.length > 0
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {selectedDocIds.length > 0 ? `Scoped to ${selectedDocIds.length}` : 'All Docs'}
            </button>

            {scopeOpen && readyDocs.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wide">Scope Search To</span>
                  {selectedDocIds.length > 0 && (
                    <button onClick={() => setSelectedDocIds([])} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {readyDocs.map(doc => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedDocIds(prev => [...prev, doc.id]);
                          } else {
                            setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-surface-800 dark:text-surface-200 truncate">{doc.original_filename}</p>
                        <p className="text-xs text-surface-400">{doc.chunk_count} chunks</p>
                      </div>
                      <FileText className="w-4 h-4 text-surface-300 flex-shrink-0" />
                    </label>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-surface-100 dark:border-surface-800">
                  <button
                    onClick={() => setScopeOpen(false)}
                    className="w-full py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Overlay to close scope dropdown */}
            {scopeOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setScopeOpen(false)} />
            )}
          </div>

          {docCount === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-warning-500/10 text-warning-600 dark:text-warning-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              No documents indexed
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {loadingMsgs ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : messages.length === 0 ? (
            /* Welcome / Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
                  Vehicle Intelligence Assistant
                </h3>
                <p className="text-surface-500 mt-2 max-w-sm">
                  Ask me anything about your uploaded vehicle documents — manuals, maintenance logs, or inspection reports.
                </p>
              </div>

              {docCount === 0 ? (
                <div className="p-4 rounded-xl bg-warning-500/10 border border-warning-500/20 text-sm text-warning-700 dark:text-warning-400 max-w-sm">
                  <AlertCircle className="w-4 h-4 inline mr-1.5" />
                  No documents indexed yet.{' '}
                  <button
                    onClick={() => navigate('/upload')}
                    className="underline font-medium"
                  >
                    Upload one first.
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
                  {[
                    'What is the recommended oil change interval?',
                    'What are the tire pressure specifications?',
                    'When should brake pads be replaced?',
                    'What type of coolant is required?',
                  ].map(sample => (
                    <button
                      key={sample}
                      onClick={() => { setQuestion(sample); inputRef.current?.focus(); }}
                      className="text-left px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
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
              {/* Only show TypingIndicator when no streaming placeholder is present */}
              {isSending && !messages.some(m => m.isStreaming) && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex-shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={docCount > 0 ? 'Ask a question about your documents...' : 'Upload documents first to start chatting...'}
                disabled={isSending}
                rows={1}
                className="w-full px-4 py-3 pr-10 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder-surface-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all leading-snug disabled:opacity-60"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
              {question && (
                <button
                  onClick={() => setQuestion('')}
                  className="absolute right-3 top-3 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!question.trim() || isSending}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-surface-200 dark:disabled:bg-surface-700 disabled:cursor-not-allowed text-white disabled:text-surface-400 transition-all shadow-sm"
            >
              {isSending
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Send className="w-5 h-5" />
              }
            </button>
          </div>
          <p className="text-xs text-surface-400 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
