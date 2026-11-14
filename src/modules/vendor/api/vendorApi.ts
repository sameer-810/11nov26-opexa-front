import { api } from '../../../shared/api/apiClient';
import type { Vendor, VendorInput } from '../types';

export const vendorApi = {
  list: () => api<Vendor[]>('/vendors'),
  create: (body: VendorInput) => api<Vendor>('/vendors', { method: 'POST', body }),
  update: (id: string, body: Partial<VendorInput> & { isActive?: boolean }) => api<Vendor>(`/vendors/${id}`, { method: 'PATCH', body }),
};
