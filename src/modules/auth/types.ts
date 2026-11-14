export type Role = 'owner' | 'purchaser' | 'engineer' | 'supervisor' | 'accounts' | 'staff';

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
  lastLoginAt?: string | null;
  createdAt?: string | null;
};
export type Organization = { id: string; name: string; phone: string | null };

export type AuthResponse = { accessToken: string; refreshToken: string; user: User; organization: Organization };

export type SignUpInput = { companyName: string; name: string; email: string; phone: string; password: string };
export type SignInInput = { email: string; password: string };
