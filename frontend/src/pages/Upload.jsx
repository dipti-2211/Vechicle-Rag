import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, CheckCircle, AlertCircle, Loader2,
  X, ChevronRight, File, FileSpreadsheet, FileType, Files, Database,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const ALLOWED = ['.pdf', '.xlsx', '.csv', '.docx', '.txt'];
const MAX_MB  = 50;

const FILE_ICONS = {
  pdf:  { icon: FileType,        color: 'text-red-400',    bg: 'bg-red-500/10' },
  xlsx: { icon: FileSpreadsheet, color: 'text-green-400',  bg: 'bg-green-500/10' },
  csv:  { icon: Database,        color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  docx: { icon: Files,           color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  txt:  { icon: FileText,        color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

function getFileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? { icon: File, color: 'text-surface-400', bg: 'bg-surface-500/10' };
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Individual file upload item
function FileItem({ item, onRemove }) {
  const fi = getFileIcon(item.file.name);
  const Icon = fi.icon;

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-4 animate-slide-up">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${fi.bg}`}>
        <Icon className={`w-5 h-5 ${fi.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">
            {item.file.name}
          </p>
          <span className="text-xs text-surface-400 flex-shrink-0">{formatSize(item.file.size)}</span>
        </div>

        {/* Progress / status */}
        {item.status === 'uploading' && (
          <div>
            <div className="h-1.5 rounded-full bg-surface-200/60 dark:bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
                style={{ width: `${item.progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-surface-400 mt-1">Uploading… {item.progress ?? 0}%</p>
          </div>
        )}
        {item.status === 'done' && (
          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Uploaded · Processing in background
          </p>
        )}
        {item.status === 'error' && (
          <p className="text-xs text-danger-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> {item.error ?? 'Upload failed'}
          </p>
        )}
        {item.status === 'pending' && (
          <p className="text-xs text-surface-400">Ready to upload</p>
        )}
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {item.status === 'uploading' && (
          <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
        )}
        {item.status === 'done' && (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        )}
        {item.status === 'error' && (
          <AlertCircle className="w-5 h-5 text-danger-400" />
        )}
        {(item.status === 'pending' || item.status === 'error') && (
          <button
            onClick={() => onRemove(item.id)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Upload() {
  const navigate   = useNavigate();
  const fileRef    = useRef(null);
  const [files, setFiles]       = useState([]);   // { id, file, status, progress, error }
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext)) {
        toast.error(`"${f.name}" is not a supported format.`);
        return false;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds the ${MAX_MB} MB limit.`);
        return false;
      }
      return true;
    });
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, status: 'pending', progress: 0 })),
    ]);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()  => setDragging(false);

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  const uploadAll = async () => {
    const pending = files.filter(f => f.status === 'pending');
    if (!pending.length) return;
    setUploading(true);

    for (const item of pending) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading', progress: 10 } : f));
      const form = new FormData();
      form.append('file', item.file);
      try {
        // Simulate progress (XHR would give real progress, but fetch doesn't)
        const progressTimer = setInterval(() => {
          setFiles(prev => prev.map(f =>
            f.id === item.id && f.status === 'uploading'
              ? { ...f, progress: Math.min((f.progress ?? 10) + 15, 85) }
              : f
          ));
        }, 300);

        await api.post('/api/documents', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        clearInterval(progressTimer);
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100 } : f));
        toast.success(`"${item.file.name}" uploaded!`);
      } catch (err) {
        const detail = err.response?.data?.detail ?? 'Upload failed. Please try again.';
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: detail } : f));
        toast.error(detail);
      }
    }
    setUploading(false);
  };

  const hasPending = files.some(f => f.status === 'pending');
  const allDone    = files.length > 0 && files.every(f => f.status === 'done');

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-extrabold text-surface-900 dark:text-white">Upload Documents</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
          Add vehicle manuals, maintenance logs, or CSV/XLSX data to your knowledge base.
        </p>
      </div>

      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`relative glass rounded-3xl p-10 border-2 border-dashed text-center cursor-pointer transition-all duration-200 group ${
          dragging
            ? 'border-primary-500 bg-primary-500/5 scale-[1.01]'
            : 'border-surface-300/60 dark:border-white/10 hover:border-primary-400/60 dark:hover:border-primary-500/50 hover:bg-primary-500/3'
        }`}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 blur-3xl transition-opacity duration-300 ${dragging ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'} bg-primary-500`} />
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ALLOWED.join(',')}
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
        />

        <div className={`w-16 h-16 rounded-2xl btn-gradient flex items-center justify-center mx-auto mb-5 shadow-lg transition-all duration-200 ${dragging ? 'scale-110' : 'group-hover:scale-105'}`}>
          <UploadCloud className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-xl font-bold text-surface-800 dark:text-surface-100 mb-2">
          {dragging ? 'Drop files here' : 'Drag & drop files here'}
        </h2>
        <p className="text-surface-500 dark:text-surface-400 text-sm mb-5">
          or <span className="text-primary-500 font-semibold">click to browse</span> your computer
        </p>

        {/* Supported formats */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {ALLOWED.map(ext => (
            <span key={ext} className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-100/80 dark:bg-white/6 text-surface-500 dark:text-surface-400 border border-surface-200/60 dark:border-white/8">
              {ext.toUpperCase()}
            </span>
          ))}
          <span className="text-xs text-surface-400">· up to {MAX_MB} MB</span>
        </div>
      </div>

      {/* ── File list ─────────────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </h3>
            {files.some(f => f.status === 'pending') && (
              <button
                onClick={() => setFiles(prev => prev.filter(f => f.status !== 'pending'))}
                className="text-xs text-surface-400 hover:text-danger-400 transition-colors"
              >
                Clear pending
              </button>
            )}
          </div>

          {files.map(item => (
            <FileItem key={item.id} item={item} onRemove={removeFile} />
          ))}

          {/* Upload button */}
          {!allDone && (
            <button
              onClick={uploadAll}
              disabled={!hasPending || uploading}
              className="w-full py-3.5 rounded-2xl btn-gradient font-semibold text-sm shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><UploadCloud className="w-4 h-4" /> Upload {files.filter(f => f.status === 'pending').length} File{files.filter(f => f.status === 'pending').length !== 1 ? 's' : ''}</>
              )}
            </button>
          )}

          {/* Success state */}
          {allDone && (
            <div className="glass rounded-2xl p-5 border border-emerald-500/20 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">All files uploaded!</p>
                <p className="text-xs text-surface-400 mt-0.5">
                  Background processing started — parsing, chunking, and embedding are underway.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigate('/documents')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-gradient text-xs font-semibold"
                >
                  View Documents <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setFiles([])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-xs font-medium text-surface-500 dark:text-surface-400 border border-white/10 dark:border-white/6 hover:text-surface-900 dark:hover:text-white transition-colors"
                >
                  Upload More
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Info section ──────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-surface-400" />
          What happens after upload?
        </h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Parse', desc: 'Text is extracted from the file (PDF/DOCX/CSV/XLSX/TXT).' },
            { step: '2', title: 'Chunk',  desc: 'Text is split into semantic chunks for better retrieval.' },
            { step: '3', title: 'Embed',  desc: 'Each chunk is converted to a vector using MiniLM-L6-v2.' },
            { step: '4', title: 'Index',  desc: 'Vectors are stored in ChromaDB and are immediately searchable.' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-primary-500/15 text-primary-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.step}
              </div>
              <div>
                <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{s.title}</span>
                <span className="text-sm text-surface-500 dark:text-surface-400"> — {s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
