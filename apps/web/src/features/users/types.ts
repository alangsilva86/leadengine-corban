export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

export type UsersStatusFilter = 'all' | 'active' | 'inactive';

export type TenantUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type UserInvite = {
  id: string;
  token: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type InviteUserInput = {
  email: string;
  role: UserRole;
  expiresInDays?: number;
  tenantSlugHint?: string;
};

export type UpdateUserInput = {
  userId: string;
  role?: UserRole;
  isActive?: boolean;
};
