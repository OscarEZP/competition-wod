// src/app/core/services/admin-user.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, updateDoc, arrayUnion, arrayRemove, documentId, getDocs, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface AppUser {
  createdAt: number;
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  roles?: string[]; // e.g. ["user"], ["user","judge"], ["admin"]
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private db = inject(Firestore);
  private usersCol = collection(this.db, 'users');

  listUsers(): Observable<AppUser[]> {
    // Incluye el id del doc como uid
    return collectionData(this.usersCol, { idField: 'uid' }) as Observable<AppUser[]>;
  }

  async addJudge(uid: string) {
    const ref = doc(this.db, 'users', uid);
    await updateDoc(ref, { roles: arrayUnion('judge') });
  }

  async removeJudge(uid: string) {
    const ref = doc(this.db, 'users', uid);
    await updateDoc(ref, { roles: arrayRemove('judge') });
  }

  async getUsersByIds(uids: string[]): Promise<AppUser[]> {
    const ids = Array.from(new Set((uids || []).filter(Boolean)));
    if (ids.length === 0) return [];

    const colRef = collection(this.db, 'users');
    const chunks: string[][] = [];
    const CHUNK = 10;
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

    const results: AppUser[] = [];
    for (const c of chunks) {
      const q = query(colRef, where(documentId(), 'in', c));
      const snap = await getDocs(q);
      snap.forEach(doc => {
        const d = doc.data() as any;
        results.push({
          uid: doc.id,
          displayName: d?.displayName ?? '—',
          email: d?.email ?? null,
          photoURL: d?.photoURL ?? null,
          roles: Array.isArray(d?.roles) ? d.roles : (d?.roles ? [d.roles] : []),
          createdAt: d?.createdAt ?? null,
        } as AppUser);
      });
    }

    // Orden opcional por displayName
    results.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    return results;
  }
}
