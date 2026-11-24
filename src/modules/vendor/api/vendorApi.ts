import { Platform } from 'react-native';
import { api } from '../../../shared/api/apiClient';
import type { PickedFile } from '../../service/api/handoverApi';
import type { Vendor, VendorDetail, VendorDocument, VendorHistory, VendorInput, VendorPerformance, VendorPerformanceDetail } from '../types';

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
  addDocument: (id: string, a: PickedFile, label: string, validUntil: string) => {
    const f = new FormData();
    if (Platform.OS === 'web' && a.file) f.append('file', a.file, a.name);
    else f.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf' } as unknown as Blob);
    if (label) f.append('label', label);
    if (validUntil) f.append('validUntil', validUntil);
    return api<VendorDocument>(`/vendors/${id}/documents`, { method: 'POST', body: f });
  },
  ranking: (q: { from?: string; to?: string } = {}) => api<{ from: string; to: string; vendors: VendorPerformance[] }>(`/vendors/performance${range(q)}`),
};
