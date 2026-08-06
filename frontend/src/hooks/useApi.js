import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

/**
 * Generic hook for API calls with loading, error, and data state.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi('/api/documents');
 *   const { data, loading, error, refetch } = useApi(() => api.post('/api/chat/ask', body), [body]);
 *
 * @param {string|Function} apiFn - Either a URL string (GET) or an async function that returns an axios response.
 * @param {Array} deps - Dependency array. Refetches when these change.
 * @param {Object} options
 * @param {boolean} options.immediate - If false, don't fetch on mount (default: true).
 * @param {*} options.initialData - Initial value for data (default: null).
 */
export function useApi(apiFn, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError]     = useState(null);

  // Use a ref to avoid stale closure issues with abort
  const abortRef = useRef(null);

  const execute = useCallback(async () => {
    // Cancel previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      let response;
      if (typeof apiFn === 'string') {
        response = await api.get(apiFn, { signal: controller.signal });
      } else {
        response = await apiFn({ signal: controller.signal });
      }
      setData(response.data);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setError(err?.response?.data?.detail ?? err.message ?? 'An error occurred');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) {
      execute();
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
