'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './apiClient.js';

/**
 * Loads and mutates the automation dashboard + scheduler settings, with
 * optimistic updates for quick toggles (pause/resume/enable). Toasts are the
 * caller's responsibility; this hook returns data, loading and error state.
 */
export function useAutomation() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/automation');
      setDashboard(data);
    } catch (err) {
      setError(err.message || 'Failed to load automation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(async (action) => {
    setActing(true);
    // Optimistic status flip for the instant toggles.
    setDashboard((prev) => {
      if (!prev) return prev;
      const settings = { ...prev.settings };
      if (action === 'enable') settings.enabled = true;
      if (action === 'disable') settings.enabled = false;
      if (action === 'pause') settings.paused = true;
      if (action === 'resume') settings.paused = false;
      return { ...prev, settings };
    });
    try {
      const data = await api('/api/automation', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setDashboard(data);
      return data;
    } finally {
      setActing(false);
    }
  }, []);

  const runNow = useCallback(async () => {
    setActing(true);
    try {
      const data = await api('/api/automation', {
        method: 'POST',
        body: JSON.stringify({ action: 'run-now' }),
      });
      if (data.dashboard) setDashboard(data.dashboard);
      return data;
    } finally {
      setActing(false);
    }
  }, []);

  return { dashboard, loading, error, acting, reload: load, act, runNow, setDashboard };
}
