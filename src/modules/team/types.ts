import type { Role, User } from '../auth/types';

export type TeamMember = User;
export type PermissionInfo = { key: string; group: string; label: string };
export type TeamMeta = { roles: Exclude<Role, 'owner'>[]; roleDefaults: Record<Role, string[]>; permissions: PermissionInfo[] };

export type NewMemberInput = { name: string; email: string; phone: string; role: Exclude<Role, 'owner'> | ''; password: string };
export type MemberUpdate = Partial<{ name: string; phone: string; role: Role; permissions: string[]; isActive: boolean }>;

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  purchaser: 'Purchaser',
  engineer: 'Project Engineer',
  supervisor: 'Site Supervisor',
  accounts: 'HR / Accounts',
  staff: 'Staff',
};

export const ROLE_HINT: Record<Role, string> = {
  owner: 'Full access',
  purchaser: 'Buys and dispatches material',
  engineer: 'Raises material requests for his sites',
  supervisor: 'Receives material and marks attendance',
  accounts: 'Attendance, payroll and billing',
  staff: 'Attendance only',
};
