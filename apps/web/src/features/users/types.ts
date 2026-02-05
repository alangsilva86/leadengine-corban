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

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type UpdateUserInput = {
  userId: string;
  role?: UserRole;
  isActive?: boolean;
};
