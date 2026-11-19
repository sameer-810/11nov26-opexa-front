import { api } from '../../../shared/api/apiClient';
import type { Vendor, VendorInput } from '../types';

export const vendorApi = {
  list: (q: { q?: string; category?: string; status?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return api<Vendor[]>(`/vendors${p ? `?${p}` : ''}`);
  },
  create: (body: VendorInput) => api<Vendor>('/vendors', { method: 'POST', body }),
  update: (id: string, body: Partial<VendorInput> & { isActive?: boolean }) => api<Vendor>(`/vendors/${id}`, { method: 'PATCH', body }),
};
