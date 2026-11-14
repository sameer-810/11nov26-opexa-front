import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/apiClient';
import { teamApi } from '../api/teamApi';
import type { TeamMeta } from '../types';

export function useTeamMeta() {
  const [meta, setMeta] = useState<TeamMeta | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setMeta(await teamApi.meta());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { meta, error, reload: load };
}
