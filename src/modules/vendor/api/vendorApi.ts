import { api } from '../../../shared/api/apiClient';
import type { Vendor, VendorDetail, VendorHistory, VendorInput, VendorPerformance, VendorPerformanceDetail } from '../types';

const range = (q: { from?: string; to?: string }) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  return p ? `?${p}` : '';
};

export const vendorApi = {
  list: (q: { q?: string; category?: string; status?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return api<Vendor[]>(`/vendors${p ? `?${p}` : ''}`);
  },
  create: (body: VendorInput) => api<Vendor>('/vendors', { method: 'POST', body }),
  update: (id: string, body: Partial<VendorInput> & { isActive?: boolean }) => api<Vendor>(`/vendors/${id}`, { method: 'PATCH', body }),
  detail: (id: string) => api<VendorDetail>(`/vendors/${id}`),
  history: (id: string) => api<VendorHistory>(`/vendors/${id}/history`),
  performance: (id: string, q: { from?: string; to?: string } = {}) => api<VendorPerformanceDetail>(`/vendors/${id}/performance${range(q)}`),
  ranking: (q: { from?: string; to?: string } = {}) => api<{ from: string; to: string; vendors: VendorPerformance[] }>(`/vendors/performance${range(q)}`),
};
