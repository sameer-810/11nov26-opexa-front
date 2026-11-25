import type { Role, User } from '../auth/types';

export type TeamMember = User;
export type PermissionInfo = { key: string; group: string; label: string };
export type TeamMeta = { roles: Exclude<Role, 'owner'>[]; roleDefaults: Record<Role, string[]>; permissions: PermissionInfo[] };

export type NewMemberInput = { name: string; email: string; phone: string; role: Exclude<Role, 'owner'> | ''; password: string; subcontractorId?: string };
export type MemberUpdate = Partial<{ name: string; phone: string; role: Role; permissions: string[]; isActive: boolean; departmentId: string | null; subcontractorId: string | null }>;

// Phase 2 access: the projects and sites a person works on.
export type AssignmentSite = { id: string; code: string; name: string };
export type Assignment = { projectId: string; projectCode: string; projectName: string; siteIds: string[]; sites: AssignmentSite[]; roleOverride: Role | null; financeAccess: boolean };
export type Assignments = { userId: string; seesAllProjects: boolean; assignments: Assignment[] };
export type AssignmentInput = { projectId: string; siteIds: string[]; financeAccess: boolean; roleOverride?: Role | null };
export type AssignmentOptions = { projects: { id: string; code: string; name: string; status: string; sites: AssignmentSite[] }[]; subcontractors: { id: string; name: string }[] };

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  purchaser: 'Purchaser',
  engineer: 'Project Engineer',
  supervisor: 'Site Supervisor',
  accounts: 'HR / Accounts',
  staff: 'Staff',
  project_manager: 'Project Manager',
  hod: 'Head of Department',
  director: 'Director',
  admin: 'Administrator',
  store_incharge: 'Store In-charge',
  service_head: 'Service Head',
  hr: 'HR',
  contractor: 'Contractor',
  worker: 'Worker',
};

export const ROLE_HINT: Record<Role, string> = {
  owner: 'Full access',
  purchaser: 'Buys and dispatches material',
  engineer: 'Raises material requests for his sites',
  supervisor: 'Receives material and marks attendance',
  accounts: 'Attendance, payroll and billing',
  staff: 'Attendance only',
  project_manager: 'Runs projects and approves requests',
  hod: 'Approves above the project manager',
  director: 'Final approval and company reports',
  admin: 'Team, settings and approval rules',
  store_incharge: 'Warehouse stock, transfers and issues',
  service_head: 'Accepts handovers, runs AMCs and complaints',
  hr: 'Attendance, payroll and the team (view)',
  contractor: 'A subcontractor login: sees its own work only',
  worker: 'Own attendance only',
};
