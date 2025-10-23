export type Category = 'RX' | 'Intermedio';

export interface Team {
  id: string;
  name: string;
  category: Category;
  membersIds: string[];   // uids de usuarios
  createdAt: number;
  createdBy: string;      // uid del creador
}
