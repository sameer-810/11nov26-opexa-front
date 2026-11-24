import { api, setTokenHandlers } from '../src/shared/api/apiClient';

const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

test('a screen reopened soon shows the remembered answer, identical requests share one call, a write empties the memory', async () => {
  setTokenHandlers({ getAccessToken: () => 't', refreshAccessToken: async () => 't' });
  let n = 0;
  const fetchMock = jest.fn(async (_url: string, init?: { method?: string }) => ok(init?.method === 'POST' ? { saved: true } : { n: ++n }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const [a, b] = await Promise.all([api<{ n: number }>('/projects'), api<{ n: number }>('/projects')]);
  expect([a.n, b.n]).toEqual([1, 1]);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  expect((await api<{ n: number }>('/projects')).n).toBe(1); // instant, refreshed in the background
  await new Promise((r) => setTimeout(r, 0));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect((await api<{ n: number }>('/projects')).n).toBe(2);

  await api('/projects', { method: 'POST', body: {} });
  const callsBefore = fetchMock.mock.calls.length;
  expect((await api<{ n: number }>('/projects')).n).toBeGreaterThan(2);
  expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
});
