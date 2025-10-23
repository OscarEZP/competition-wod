import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, updateDoc, deleteDoc, docData, query, where } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Wod, Category } from '../models/wod';
import { AuthService } from './auth.service';

function stripUndefined(obj: any) {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v === undefined) delete obj[k];
      else if (Array.isArray(v)) v.forEach(stripUndefined);
      else if (typeof v === 'object') stripUndefined(v);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class WodService {
  private db = inject(Firestore);
  private auth = inject(AuthService);
  private col = collection(this.db, 'wods');

  listAll$(): Observable<Wod[]> {
    return collectionData(this.col, { idField: 'id' }) as Observable<Wod[]>;
  }

  listByCategory$(category: Category): Observable<Wod[]> {
    const q = query(this.col, where('category', '==', category));
    return collectionData(q, { idField: 'id' }) as Observable<Wod[]>;
  }

  get$(id: string): Observable<Wod | null> {
    const ref = doc(this.db, 'wods', id);
    return docData(ref, { idField: 'id' }).pipe(map(d => (d ? (d as Wod) : null)));
  }

  async create(input: Omit<Wod, 'id' | 'createdAt' | 'createdBy'>): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const payload: any = { ...input, createdAt: Date.now(), createdBy: user.uid };
    stripUndefined(payload);
    const created = await addDoc(this.col, payload);
    return created.id;
  }

  async update(id: string, patch: Partial<Omit<Wod, 'id'>>): Promise<void> {
    const ref = doc(this.db, 'wods', id);
    const payload: any = { ...patch };
    stripUndefined(payload);
    await updateDoc(ref, payload);
  }

  async remove(id: string): Promise<void> {
    const ref = doc(this.db, 'wods', id);
    await deleteDoc(ref);
  }
}
