import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback((acceptedFiles) => {
    // Map accepted files to add a local preview/status state
    const mapped = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'pending' // pending, uploading, success, error
    }));
    setFiles(prev => [...prev, ...mapped]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const removeFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i];
      if (fileObj.status === 'success') {
        successCount++;
        continue;
      }

      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'uploading' } : f));

      const formData = new FormData();
      formData.append('file', fileObj.file);

      try {
        await api.post('/api/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, progress: percent } : f));
          }
        });
        
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'success', progress: 100 } : f));
        successCount++;
      } catch (error) {
        console.error('Upload error:', error);
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error' } : f));
        toast.error(`Failed to upload ${fileObj.file.name}`);
      }
    }

    setIsUploading(false);
    
    if (successCount === files.length) {
      toast.success('All files uploaded successfully!');
      setTimeout(() => navigate('/documents'), 1000);
    } else if (successCount > 0) {
      toast.success(`Uploaded ${successCount} out of ${files.length} files.`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Upload Documents</h1>
        <p className="text-surface-500 mt-2">Upload PDFs, CSVs, or text files for the assistant to analyze.</p>
      </header>

      {/* Dropzone */}
      <div 
        {...getRootProps()} 
        className={`
          bg-white dark:bg-surface-900 rounded-xl border-2 border-dashed p-12 
          flex flex-col items-center justify-center text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' 
            : 'border-surface-300 dark:border-surface-700 hover:border-primary-400 dark:hover:border-primary-600'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mb-4">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">
          {isDragActive ? "Drop files here..." : "Drag & drop files here"}
        </h3>
        <p className="text-surface-500 mt-1 mb-2">or click to browse from your computer</p>
        <span className="text-xs text-surface-400">Supported formats: PDF, CSV, XLSX, DOCX, TXT (Max 50MB)</span>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm p-6 space-y-4">
          <h3 className="font-medium text-surface-900 dark:text-surface-100 mb-4">
            Selected Files ({files.length})
          </h3>
          
          <div className="space-y-3">
            {files.map((fileObj) => (
              <div 
                key={fileObj.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/50"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <File className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate w-48 sm:w-64">
                      {fileObj.file.name}
                    </p>
                    <p className="text-xs text-surface-500">
                      {(fileObj.file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {fileObj.status === 'uploading' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{fileObj.progress}%</span>
                      <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    </div>
                  )}
                  {fileObj.status === 'success' && <CheckCircle className="w-5 h-5 text-accent-500" />}
                  {fileObj.status === 'error' && <AlertCircle className="w-5 h-5 text-danger-500" />}
                  
                  {fileObj.status !== 'uploading' && fileObj.status !== 'success' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFile(fileObj.id); }}
                      className="p-1 rounded-md text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-danger-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={uploadFiles}
              disabled={isUploading || files.every(f => f.status === 'success')}
              className={`
                px-6 py-2 rounded-lg font-medium transition-all shadow-sm
                ${isUploading || files.every(f => f.status === 'success')
                  ? 'bg-surface-200 dark:bg-surface-800 text-surface-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20 hover:shadow-primary-500/40'
                }
              `}
            >
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
