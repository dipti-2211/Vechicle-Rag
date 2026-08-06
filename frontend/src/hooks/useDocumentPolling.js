import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';

/**
 * Hook that fetches the document list and auto-polls while any document
 * is in 'processing' status. Polling stops automatically once all documents
 * reach a terminal state ('ready' or 'error').
 *
 * Usage:
 *   const { documents, loading, error, refetch } = useDocumentPolling();
 *   const { documents, loading, error, refetch } = useDocumentPolling(5000); // 5s interval
 *
 * @param {number} intervalMs - Polling interval in milliseconds (default: 3000).
 * @returns {{ documents: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export function useDocumentPolling(intervalMs = 3000) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const intervalRef               = useRef(null);
  const mountedRef                = useRef(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.get('/api/documents');
      if (!mountedRef.current) return;

      const docs = res.data.documents ?? [];
      setDocuments(docs);
      setError(null);

      // Check if any document is still processing
      const hasProcessing = docs.some(d => d.status === 'processing');

      if (!hasProcessing) {
        // All documents settled — stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (!intervalRef.current) {
        // Some still processing but no timer running — start one
        intervalRef.current = setInterval(fetchDocuments, intervalMs);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.response?.data?.detail ?? 'Failed to load documents.');
      // Don't stop polling on error — retry on next tick
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [intervalMs]);

  // On mount: initial fetch (which may start polling if needed)
  useEffect(() => {
    mountedRef.current = true;
    fetchDocuments();

    return () => {
      // Cleanup: stop timer and mark unmounted
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchDocuments]);

  /**
   * Manual refetch — also restarts polling if any doc is processing.
   */
  const refetch = useCallback(() => {
    // Reset loading for manual refresh
    setLoading(true);
    // Stop existing timer before re-fetching
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch };
}
