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
  projectManagerId?: string | null;
  projectManager?: { id: string; name: string; role: string } | null;
  milestones?: MilestoneProgress | null;
};

export type MilestoneProgress = { total: number; done: number; delayed: number; progressPct: number };
export type MilestoneStatus = 'planned' | 'in_progress' | 'done' | 'delayed';
export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  plannedDate: string;
  actualDate: string | null;
  startedAt: string | null;
  status: MilestoneStatus;
  ownerId: string | null;
  ownerName: string | null;
  remarks: string | null;
};
export type MilestoneInput = { name: string; plannedDate: string; actualDate?: string | null; started?: boolean; ownerId?: string | null; remarks?: string };
export type MilestoneList = { milestones: Milestone[]; progress: MilestoneProgress };
export const MILESTONE_LABEL: Record<MilestoneStatus, string> = { planned: 'Planned', in_progress: 'In progress', done: 'Done', delayed: 'Delayed' };

export type ProjectInput = {
  name: string;
  clientName: string;
  siteAddress?: string;
  clientPoNumber?: string;
  location?: { lat: number; lng: number } | null;
  geofenceRadiusM?: number;
  status?: ProjectStatus;
  projectManagerId?: string | null;
};

export type BoqItem = { id: string; projectId: string; serialNo: string; description: string; unit: string; quantity: number; rate: number; amount: number };
export type BoqItemInput = { serialNo: string; description: string; unit: string; quantity: number; rate?: number };

export type ImportRow = { row: number; serialNo: string; description: string; unit: string; quantity: number | null; rate: number | null; errors: string[] };
export type ImportResult = { rows: ImportRow[]; validCount: number; errorCount: number; imported: number };

export type AssignableUser = { id: string; name: string; email: string; role: string; canManage?: boolean };

export const STATUS_LABEL: Record<ProjectStatus, string> = { active: 'Active', closing: 'Closing', closed: 'Closed' };
