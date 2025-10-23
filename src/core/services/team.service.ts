import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, collectionData, query, where, docData } from '@angular/fire/firestore';
import { Team, Category } from '../models/team';
import { AuthService } from './auth.service';
import { addDoc, serverTimestamp, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore'; // desde SDK base
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private db = inject(Firestore);
  private col = collection(this.db, 'teams');
  private auth = inject(AuthService);
  private colRef = collection(this.db, 'teams');

  listAll$(): Observable<Team[]> {
    const q = query(this.col, orderBy('name', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Team[]>;
  }

  listByCategory$(category: Category): Observable<Team[]> {
    const q = query(this.col, where('category', '==', category), orderBy('name', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Team[]>;
  }

  getById$(id: string): Observable<Team | null> {
    const ref = doc(this.db, 'teams', id);
    return docData(ref, { idField: 'id' }).pipe(map(d => (d ? (d as Team) : null)));
  }

  async create(name: string, category: Category): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const data: Omit<Team, 'id'> = {
      name,
      category,
      membersIds: [],
      createdAt: Date.now(),
      createdBy: user.uid,
    };
    const added = await addDoc(this.colRef, data as any);
    return added.id;
  }

  async update(teamId: string, patch: Partial<Omit<Team, 'id'>>): Promise<void> {
    const ref = doc(this.db, 'teams', teamId);
    await updateDoc(ref, patch as any);
  }

  async remove(teamId: string): Promise<void> {
    const ref = doc(this.db, 'teams', teamId);
    await deleteDoc(ref);
  }

  /** Une al usuario actual a un equipo y guarda teamId en su perfil */
  async joinTeam(teamId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // 1) añade uid al equipo
    const teamRef = doc(this.db, 'teams', teamId);
    await updateDoc(teamRef, { membersIds: arrayUnion(user.uid) });

    // 2) guarda teamId en el perfil del usuario
    const userRef = doc(this.db, 'users', user.uid);
    await setDoc(userRef, { teamId }, { merge: true });
  }

  /** Sale del equipo y limpia teamId */
  async leaveTeam(teamId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const teamRef = doc(this.db, 'teams', teamId);
    await updateDoc(teamRef, { membersIds: arrayRemove(user.uid) });

    const userRef = doc(this.db, 'users', user.uid);
    await setDoc(userRef, { teamId: null }, { merge: true });
  }
  
}
