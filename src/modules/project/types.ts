export type ProjectStatus = 'active' | 'closing' | 'closed';

export type Project = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  siteAddress: string | null;
  clientPoNumber: string | null;
  poDate: string | null;
  location: { lat: number; lng: number } | null;
  geofenceRadiusM: number;
  status: ProjectStatus;
  memberIds: string[];
  boqItemCount: number;
  boqValue: number;
};

export type ProjectInput = {
  name: string;
  clientName: string;
  siteAddress?: string;
  clientPoNumber?: string;
  location?: { lat: number; lng: number } | null;
  geofenceRadiusM?: number;
  status?: ProjectStatus;
};

export type BoqItem = { id: string; projectId: string; serialNo: string; description: string; unit: string; quantity: number; rate: number; amount: number };
export type BoqItemInput = { serialNo: string; description: string; unit: string; quantity: number; rate?: number };

export type ImportRow = { row: number; serialNo: string; description: string; unit: string; quantity: number | null; rate: number | null; errors: string[] };
export type ImportResult = { rows: ImportRow[]; validCount: number; errorCount: number; imported: number };

export type AssignableUser = { id: string; name: string; email: string; role: string };

export const STATUS_LABEL: Record<ProjectStatus, string> = { active: 'Active', closing: 'Closing', closed: 'Closed' };
