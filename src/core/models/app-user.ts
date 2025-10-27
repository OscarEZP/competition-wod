import { Role } from './role';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;        // 'admin' | 'judge' | 'user'
  teamId?: string;   // se llenará en la Fase 3 (equipos)
  createdAt: any; // Date.now()
}
