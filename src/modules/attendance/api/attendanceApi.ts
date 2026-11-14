import { api } from '../../../shared/api/apiClient';
import type { AttendanceRecord, Mine, Office, TeamDay, TeamMonth, Today } from '../types';

export type PunchInput = { place: 'project' | 'office'; projectId?: string | null; lat: number; lng: number; accuracy: number; mocked: boolean };

function form(p: PunchInput, selfie: Blob | { uri: string; name: string; type: string } | null) {
  const f = new FormData();
  f.append('place', p.place);
  if (p.projectId) f.append('projectId', p.projectId);
  f.append('lat', String(p.lat));
  f.append('lng', String(p.lng));
  f.append('accuracy', String(p.accuracy));
  f.append('mocked', String(p.mocked));
  // Web sends a Blob with a file name; phones send React Native's { uri, name, type } file object.
  if (selfie && typeof Blob !== 'undefined' && selfie instanceof Blob) f.append('selfie', selfie, 'selfie.jpg');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (selfie) f.append('selfie', selfie as any);
  return f;
}

export const attendanceApi = {
  today: () => api<Today>('/attendance/today'),
  checkIn: (p: PunchInput, selfie: Parameters<typeof form>[1]) => api<AttendanceRecord>('/attendance/check-in', { method: 'POST', body: form(p, selfie) }),
  checkOut: (p: PunchInput, selfie: Parameters<typeof form>[1]) => api<AttendanceRecord>('/attendance/check-out', { method: 'POST', body: form(p, selfie) }),
  mine: (month?: string) => api<Mine>(`/attendance/mine${month ? `?month=${month}` : ''}`),
  teamDay: (date: string, projectId?: string) => api<TeamDay>(`/attendance/team?date=${date}${projectId ? `&projectId=${projectId}` : ''}`),
  teamMonth: (month: string) => api<TeamMonth>(`/attendance/team?month=${month}`),
  correct: (id: string, body: { checkIn: string; checkOut: string; reason: string }) => api<AttendanceRecord>(`/attendance/${id}/correct`, { method: 'POST', body }),
  manual: (body: { userId: string; place: 'project' | 'office'; projectId?: string; date: string; checkIn: string; checkOut: string; reason: string }) => api<AttendanceRecord>('/attendance/manual', { method: 'POST', body }),
  office: () => api<Office>('/attendance/office'),
  setOffice: (body: { name: string; lat: number; lng: number; radiusM: number }) => api<Office>('/attendance/office', { method: 'PUT', body }),
};
