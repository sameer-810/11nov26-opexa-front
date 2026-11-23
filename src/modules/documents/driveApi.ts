import { api, apiBlob } from '../../shared/api/apiClient';

// 5D project drive: uploaded documents (with versions, comments, archive) and every transaction attachment of the project.
export type DriveVersion = { version: number; name: string; note: string; at: string };
export type DriveDoc = {
  id: string; folder: string; title: string; kind: 'file' | 'note'; restricted: boolean;
  meeting: { date: string | null; attendees: string[]; text: string } | null;
  linkedTo: { type: string; label: string } | null; currentVersion: number; versions: DriveVersion[];
  comments: { id: string; byName: string; at: string; text: string }[];
  archived: { at: string; reason: string } | null;
};
export type DriveAttachment = {
  id: string; folder: string; name: string; label: string; size: number; uploadedAt: string;
  source: { type: string; label: string; number: string; link: string };
};
export type DriveFolder = { name: string; count: number; attachments: number; access: 'all' | 'commercial' | 'billing' };
export type Drive = { folders: DriveFolder[]; documents: DriveDoc[]; attachments: DriveAttachment[]; canWrite: boolean; canManage: boolean };

const base = (projectId: string) => `/projects/${projectId}`;
const qs = (q: Record<string, string>) => {
  const p = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return p ? `?${p}` : '';
};

export const driveApi = {
  get: (projectId: string, folder: string, archived: boolean) => api<Drive>(`${base(projectId)}/drive${qs({ folder, archived: archived ? 'true' : '' })}`),
  upload: (projectId: string, form: FormData) => api<DriveDoc>(`${base(projectId)}/documents`, { method: 'POST', body: form }),
  note: (projectId: string, body: { title: string; date: string; attendees: string[]; text: string }) => api<DriveDoc>(`${base(projectId)}/documents/notes`, { method: 'POST', body }),
  comment: (projectId: string, docId: string, text: string) => api<DriveDoc>(`${base(projectId)}/documents/${docId}/comments`, { method: 'POST', body: { text } }),
  archive: (projectId: string, docId: string, reason: string) => api<DriveDoc>(`${base(projectId)}/documents/${docId}/archive`, { method: 'POST', body: { reason } }),
  restore: (projectId: string, docId: string) => api<DriveDoc>(`${base(projectId)}/documents/${docId}/restore`, { method: 'POST' }),
  file: (projectId: string, docId: string, version: number) => apiBlob(`${base(projectId)}/documents/${docId}/file?version=${version}`),
  attachment: (projectId: string, fileId: string) => apiBlob(`${base(projectId)}/drive/files/${fileId}`),
};
