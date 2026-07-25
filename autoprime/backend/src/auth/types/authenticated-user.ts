import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  // Nulo apenas para SUPER_ADMIN — todo outro papel pertence a uma empresa.
  companyId: string | null;
  employeeId?: string;
  clientId?: string;
}
