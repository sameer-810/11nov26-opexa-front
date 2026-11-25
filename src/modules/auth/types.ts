export type Role = 'owner' | 'purchaser' | 'engineer' | 'supervisor' | 'accounts' | 'staff' | 'project_manager' | 'hod' | 'director' | 'admin' | 'store_incharge' | 'service_head' | 'hr';

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  organizationId: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  departmentId?: string | null;
  emailNotifications?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
};
export type Organization = { id: string; name: string; phone: string | null };

export type AuthResponse = { accessToken: string; refreshToken: string; user: User; organization: Organization };

export type SignInInput = { email: string; password: string };
