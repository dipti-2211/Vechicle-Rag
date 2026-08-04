import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Trash2, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { LoadingSpinner } from '../components/ui/Loading';
import { ErrorState } from '../components/ui/ErrorState';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/api/documents');
      setDocuments(response.data.documents);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Could not load your documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const deleteDocument = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await api.delete(`/api/documents/${id}`);
      setDocuments(documents.filter(doc => doc.id !== id));
      toast.success('Document deleted');
    } catch (err) {
      console.error('Failed to delete document:', err);
      toast.error('Failed to delete document');
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'ready': return <CheckCircle className="w-4 h-4 text-accent-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-danger-500" />;
      default: return <Clock className="w-4 h-4 text-surface-400" />;
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Documents</h1>
          <p className="text-surface-500 mt-2">Manage your uploaded vehicle manuals and logs.</p>
        </div>
        <button 
          onClick={() => navigate('/upload')}
          className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm shadow-primary-500/20 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Upload New
        </button>
      </header>

      {isLoading ? (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 flex justify-center">
          <LoadingSpinner size={32} />
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm p-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
            <p className="text-surface-600 dark:text-surface-400 mb-4">{error}</p>
            <button 
              onClick={fetchDocuments}
              className="px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-surface-900 dark:text-surface-100 font-medium hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">No documents yet</h3>
          <p className="text-surface-500 mt-1 mb-6 text-center max-w-sm">
            Upload your first vehicle document to let the AI assistant start helping you.
          </p>
          <button 
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 bg-surface-900 dark:bg-surface-100 hover:bg-surface-800 dark:hover:bg-surface-200 text-white dark:text-surface-900 px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <UploadCloud className="w-5 h-5" />
            Upload Document
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-50 dark:bg-surface-800/50 text-surface-500 dark:text-surface-400 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Document</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-surface-900 dark:text-surface-100 w-48 sm:w-64 truncate">
                            {doc.original_filename}
                          </p>
                          <p className="text-xs text-surface-500 uppercase">
                            {doc.file_type}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 capitalize text-surface-700 dark:text-surface-300">
                        {getStatusIcon(doc.status)}
                        {doc.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-surface-600 dark:text-surface-400">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 text-surface-600 dark:text-surface-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => deleteDocument(doc.id)}
                        className="p-2 rounded-lg text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
