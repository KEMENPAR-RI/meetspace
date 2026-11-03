import type { UserRoleName } from '@/lib/auth/types';

// Superadmin account list/edit (client-safe). Never includes the password hash (E7).
export type UserListItem = {
  id: string;
  username: string;
  name: string;
  role: UserRoleName;
  isActive: boolean;
  createdAt: Date;
  rooms: { id: string; name: string }[];
};

export type UserForEdit = Omit<UserListItem, 'createdAt'>;
