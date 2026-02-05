import type { TenantUser, UserRole } from '../types';
type UsersTableProps = {
    users: TenantUser[];
    onRoleChange: (userId: string, role: UserRole) => void;
    onToggleActive: (userId: string, nextValue: boolean) => void;
    onRemove: (userId: string) => void;
    busyUserIds?: string[];
    currentUserId?: string | null;
};
declare const UsersTable: ({ users, onRoleChange, onToggleActive, onRemove, busyUserIds, currentUserId, }: UsersTableProps) => import("react/jsx-runtime").JSX.Element;
export default UsersTable;
