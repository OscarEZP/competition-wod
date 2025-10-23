import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { docData } from '@angular/fire/firestore';
import { map, switchMap, of, shareReplay } from 'rxjs';
import { AppUser } from '../models/app-user';
import { Role } from '../models/role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private db = inject(Firestore);

  /** Firebase user (crudo) */
  firebaseUser$ = authState(this.auth);

  /** Perfil completo (roles, etc.) */
  appUser$ = this.firebaseUser$.pipe(
    switchMap((fbUser) => {
      if (!fbUser) return of(null);
      const ref = doc(this.db, 'users', fbUser.uid);
      return docData(ref).pipe(
        map((data) => (data ? (data as AppUser) : null))
      );
    }),
    shareReplay(1)
  );

  /** Helpers síncronos (si necesitas en guards) */
  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async register(email: string, password: string, displayName?: string, role: Role = 'user'): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const userDoc: AppUser = {
      uid: cred.user.uid,
      email,
      displayName: cred.user.displayName || '',
      role,            // por defecto 'user'
      createdAt: Date.now(),
    };
    await setDoc(doc(this.db, 'users', cred.user.uid), userDoc, { merge: true });
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /** Promueve/baja de rol (solo admin la usará desde UI admin) */
  async setRole(uid: string, role: Role): Promise<void> {
    const ref = doc(this.db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('User profile not found');
    await setDoc(ref, { role }, { merge: true });
  }
}
