import type { User } from '../auth/types';
import { can, PERMS } from '../../shared/permissions';

// Same rule as the API: site staff on the project, or a manager.
export const canRecordAtSite = (user: User | null | undefined, memberIds: string[] = []) =>
  can(user, PERMS.PROJECT_MANAGE) || (can(user, PERMS.RECEIVING_RECORD) && !!user && memberIds.includes(user.id));
