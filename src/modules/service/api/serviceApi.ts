import { Platform, Share } from 'react-native';
import { env } from '../../../config/env';
import { api } from '../../../shared/api/apiClient';

export type Asset = {
  id: string; projectId: string; projectName: string | null; name: string; brand: string; model: string; serialNo: string; location: string;
  installedOn: string; warrantyMonths: number; warrantyEnd: string; underWarranty: boolean; pmEveryMonths: number; nextPmDate: string | null;
};
export type TicketStatus = 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
export type Ticket = {
  id: string; number: string; kind: 'complaint' | 'preventive'; title: string; description: string; priority: 'low' | 'normal' | 'urgent';
  project: { id: string; code?: string; name?: string }; asset: Asset | null; contactName: string; contactPhone: string; source: 'app' | 'client-link' | 'system';
  status: TicketStatus; underWarranty: boolean; charge: number; assignedTo: { id: string; name: string } | null;
  visits: { at: string; byName: string; note: string; partsUsed: string; status: string }[];
  createdAt: string; resolvedAt: string | null; closedAt: string | null; clientRating: number | null;
};
export type NewAssets = { projectId: string; name: string; brand?: string; model?: string; serials: string[]; location?: string; installedOn: string; warrantyMonths: number; pmEveryMonths: number };
export type NewTicket = { projectId: string; assetId?: string; title: string; description?: string; priority: 'low' | 'normal' | 'urgent'; contactName?: string; contactPhone?: string };

export const serviceApi = {
  tickets: (q: { status?: string; mine?: boolean } = {}) => api<Ticket[]>(`/service/tickets?${new URLSearchParams({ ...(q.status ? { status: q.status } : {}), ...(q.mine ? { mine: '1' } : {}) })}`),
  ticket: (id: string) => api<Ticket>(`/service/tickets/${id}`),
  create: (body: NewTicket) => api<Ticket>('/service/tickets', { method: 'POST', body }),
  assign: (id: string, userId: string) => api<Ticket>(`/service/tickets/${id}/assign`, { method: 'POST', body: { userId } }),
  visit: (id: string, body: { note: string; partsUsed?: string; status: 'in-progress' | 'resolved'; charge?: number }) => api<Ticket>(`/service/tickets/${id}/visits`, { method: 'POST', body }),
  close: (id: string, clientRating?: number) => api<Ticket>(`/service/tickets/${id}/close`, { method: 'POST', body: clientRating ? { clientRating } : {} }),
  reopen: (id: string) => api<Ticket>(`/service/tickets/${id}/reopen`, { method: 'POST', body: {} }),
  technicians: () => api<{ id: string; name: string; role: string }[]>('/service/technicians'),
  assets: (projectId?: string) => api<Asset[]>(`/service/assets${projectId ? `?projectId=${projectId}` : ''}`),
  addAssets: (body: NewAssets) => api<Asset[]>('/service/assets/bulk', { method: 'POST', body }),
  publicLink: (projectId: string, regenerate = false) => api<{ path: string }>(`/service/projects/${projectId}/public-link`, { method: 'POST', body: { regenerate } }),
};

export const fullPublicUrl = (path: string) => env.apiUrl + path;

// Phones open the share sheet (WhatsApp etc.); the web copies the link.
export async function shareLink(url: string, projectName: string): Promise<'shared' | 'copied' | 'shown'> {
  const message = `To report an AC / HVAC problem at ${projectName}, open: ${url}`;
  if (Platform.OS !== 'web') {
    await Share.share({ message });
    return 'shared';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'shown';
  }
}

export const STATUS_LABEL: Record<TicketStatus, string> = { open: 'New', assigned: 'Assigned', 'in-progress': 'Working', resolved: 'Resolved', closed: 'Closed' };
export const STATUS_TONE = { open: 'danger', assigned: 'info', 'in-progress': 'warning', resolved: 'success', closed: 'neutral' } as const;
export const PRIORITY_LABEL = { low: 'Low', normal: 'Normal', urgent: 'Urgent' } as const;
export const splitSerials = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
