// src/core/services/score.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore
} from '@angular/fire/firestore';
import {
  // Usa SIEMPRE el SDK modular para refs + trx
  collection, doc, query, where, orderBy, setDoc, updateDoc,
  getDoc, runTransaction, increment, serverTimestamp, DocumentReference
} from 'firebase/firestore';
import { collectionData, docData } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Score } from '../models/score';
import { AuthService } from './auth.service';

const BIG = 1_000_000_000; // penalizador muy grande para DNF/ties en 'time'

@Injectable({ providedIn: 'root' })
export class ScoreService {
  private db = inject(Firestore);
  private auth = inject(AuthService);
  private col = collection(this.db as any, 'scores');

  // ======= Lectura =======
  listForWod$(wodId: string): Observable<Score[]> {
    const q = query(
      this.col,
      where('wodId', '==', wodId),
      orderBy('rankPrimary', 'asc'),
      orderBy('rankSecondary', 'asc'),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Score[]>;
  }

  get$(id: string): Observable<Score | null> {
    const ref = doc(this.db as any, 'scores', id);
    return docData(ref, { idField: 'id' }).pipe(map(d => (d ? d as Score : null)));
  }

  // ======= Helpers =======
  scoreId(wodId: string, teamId: string, category: 'RX'|'Intermedio') {
    return `${wodId}__${teamId}__${category}`;
  }

  private epochNow() { return Date.now(); }

  private stripUndefined(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === undefined) delete obj[k];
      else if (Array.isArray(v)) v.forEach(x => this.stripUndefined(x));
      else if (typeof v === 'object') this.stripUndefined(v);
    }
  }

  /**
   * Reglas de ranking:
   * - time: menor tiempo gana; si no terminó/ DNF -> capMs + (BIG - reps)
   * - reps: mayor reps gana => rankPrimary = -reps
   * - load: mayor carga gana; empate por reps => rankPrimary = -(maxLoadKg*1000 + reps)
   * - Desempate global: rankSecondary = -updatedAtEpoch (más reciente gana el desempate)
   */
  computeRanks(opts: {
    scoringMode: 'time'|'reps'|'load',
    finalTimeMs?: number | null,
    capSeconds?: number | null,
    finished?: boolean,
    reps: number,
    maxLoadKg?: number | null,
  }, updatedAtEpoch: number): { rankPrimary: number, rankSecondary: number } {
    const { scoringMode, finalTimeMs, capSeconds, finished, reps, maxLoadKg } = opts;

    if (scoringMode === 'time') {
      const capMs = (capSeconds ?? 0) * 1000;
      if (finished && finalTimeMs != null) {
        return { rankPrimary: finalTimeMs, rankSecondary: -updatedAtEpoch };
      }
      // Mientras corre o DNF/paused: ordena por reps (más reps => mejor), siempre detrás del cap
      const penalty = BIG - (reps || 0);
      return { rankPrimary: capMs + penalty, rankSecondary: -updatedAtEpoch };
    }

    if (scoringMode === 'reps') {
      return { rankPrimary: -(reps || 0), rankSecondary: -updatedAtEpoch };
    }

    // load
    const loadVal = Math.round(((maxLoadKg ?? 0) * 1000) + Math.max(0, reps || 0));
    return { rankPrimary: -loadVal, rankSecondary: -updatedAtEpoch };
  }

  // ======= Upsert inicial =======
  async ensureScoreDoc(args: {
    wodId: string; wodName: string;
    category: 'RX'|'Intermedio';
    teamId: string; teamName: string;
    scoringMode: 'time'|'reps'|'load';
    capSeconds?: number | null;
  }): Promise<string> {
    const id = this.scoreId(args.wodId, args.teamId, args.category);
    const ref = doc(this.db as any, 'scores', id) as DocumentReference;
    const user = this.auth.currentUser;
    const now = this.epochNow();

    const base = {
      id,
      wodId: args.wodId,
      wodName: args.wodName,
      scoringMode: args.scoringMode,
      category: args.category,
      teamId: args.teamId,
      teamName: args.teamName,
      status: 'not_started',
      reps: 0,
      noReps: 0,
      maxLoadKg: null,
      attempts: [],
      startedAt: null as number | null, // mantenemos epoch para UI actual
      finalTimeMs: null as number | null,
      capSeconds: args.capSeconds ?? null,
      // ranking inicial
      ...(() => {
        const ranks = this.computeRanks({
          scoringMode: args.scoringMode,
          finalTimeMs: null,
          capSeconds: args.capSeconds ?? null,
          finished: false,
          reps: 0,
          maxLoadKg: null,
        }, now);
        return { rankPrimary: ranks.rankPrimary, rankSecondary: ranks.rankSecondary };
      })(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedAtEpoch: now,  // para desempates deterministas
      judgeId: user?.uid || null,
    };

    this.stripUndefined(base);
    await setDoc(ref, base, { merge: true });
    return id;
  }

  // ======= Acciones en tiempo real =======

  /** Incrementa reps en transacción y recalcula ranking inmediatamente (a prueba de concurrencia) */
  async incrementReps(scoreId: string, by: number = 1) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();

    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      console.log('Current data:', data); // Debug actual state
      console.log('Current reps:', data.reps); // Debug reps actuales
      
      // Asegurar que data.reps sea un número
      const currentReps = typeof data.reps === 'number' ? data.reps : 0;
      const reps = Math.max(0, currentReps + by);
      
      console.log('Calculated new reps:', reps); // Debug nuevo valor

      // No permitir mutaciones tras finish/dnf
      if (data.status === 'finished' || data.status === 'dnf') {
        console.log('Score is finished or DNF, skipping increment');
        return;
      }

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: data.finalTimeMs ?? null,
        capSeconds: data.capSeconds ?? null,
        reps,
        maxLoadKg: data.maxLoadKg ?? null,
      }, now);

      const update = {
        reps,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      };

      console.log('Updating with:', update); // Debug update object
      
      try {
        await trx.update(ref, update);
        console.log('Update successful');
      } catch (error) {
        console.error('Update failed:', error);
        throw error;
      }
    });
}

  /** Incrementa no-reps en transacción y recalcula ranking si aplica (no afecta ranking en 'reps'/'load' por diseño) */
  async incrementNoReps(scoreId: string, by: number = 1) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();

    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      // No permitir mutaciones tras finish/dnf
      if (data.status === 'finished' || data.status === 'dnf') return;

      const noReps = Math.max(0, (data.noReps || 0) + by);

      // En 'time', el ranking usa reps para ordenar DNFs. Aquí NO cambiamos reps.
      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: data.finalTimeMs ?? null,
        capSeconds: data.capSeconds ?? null,
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      }, now);

      const update = {
        noReps,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      };

      console.log('Updating with:', update); // Debug update object
      
      try {
        await trx.update(ref, update);
        console.log('Update successful');
      } catch (error) {
        console.error('Update failed:', error);
        throw error;
      }
    });
  }

  /** Guarda intento de carga y recomputa ranking */
  async addLoadAttempt(scoreId: string, loadKg: number, success = true) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();
    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      if ( data.status === 'dnf') return;

      const attempts = Array.isArray(data.attempts) ? [...data.attempts] : [];
      attempts.push({ at: now, loadKg, success });

      const maxLoad = success ? Math.max(loadKg, data.maxLoadKg ?? 0) : (data.maxLoadKg ?? null);
      
      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: data.finalTimeMs ?? null,
        capSeconds: data.capSeconds ?? null,
        finished: data.status === 'finished',
        reps: data.reps || 0,
        maxLoadKg: maxLoad,
      }, now);

      const update = {
        attempts,
        maxLoadKg: maxLoad,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      };

      console.log('Updating with:', update); // Debug update object
      
      try {
        await trx.update(ref, update);
        console.log('Update successful');
      } catch (error) {
        console.error('Update failed:', error);
        throw error;
      }
    });
  }

  /** Marca inicio o reanudación del timer */
  async start(scoreId: string, forcedStartedAtMs?: number) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();

    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      if (data.status === 'running' || data.status === 'finished') return;

      const startedAt = (typeof forcedStartedAtMs === 'number') ? forcedStartedAtMs : now;

      trx.update(ref, {
        status: 'running',
        startedAt,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      } as any);
    });
  }

  /** Pausa (guarda status='paused' y congela finalTimeMs) */
  async stop(scoreId: string) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();

    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      if (data.status === 'finished' || data.status === 'dnf') return;

      let finalTimeMs = data.finalTimeMs ?? null;
      if (data.startedAt) {
        finalTimeMs = now - data.startedAt;
      }

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs,
        capSeconds: data.capSeconds ?? null,
        finished: false, // pausa no es finish
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      }, now);

      trx.update(ref, {
        status: 'paused',
        finalTimeMs,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      } as any);
    });
  }

  /** Finaliza (bloquea el tiempo si aplica y recalcula ranking como 'finished') */
  async finish(scoreId: string, elapsedMs?: number | null) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();

    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      if (data.status === 'finished') return; // idempotente

      let finalTimeMs = data.finalTimeMs ?? null;

      if (data.scoringMode === 'time') {
        if (typeof elapsedMs === 'number' && elapsedMs >= 0) {
          finalTimeMs = elapsedMs;
        } else if (data.startedAt && finalTimeMs == null) {
          finalTimeMs = now - data.startedAt;
        }
      } else {
        finalTimeMs = null;
      }

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs,
        capSeconds: data.capSeconds ?? null,
        finished: true,
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      }, now);

      trx.update(ref, {
        status: 'finished',
        finalTimeMs,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      } as any);
    });
  }
  

  /** Marca DNF y recalcula ranking (usa reps para ordenar DNFs en 'time') */
  async markDNF(scoreId: string) {
    const ref = doc(this.db as any, 'scores', scoreId) as DocumentReference;
    const now = this.epochNow();

    await runTransaction(this.db as any, async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      if (data.status === 'finished' || data.status === 'dnf') return;

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: null,
        capSeconds: data.capSeconds ?? null,
        finished: false,
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      }, now);

      trx.update(ref, {
        status: 'dnf',
        finalTimeMs: null,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: serverTimestamp(),
        updatedAtEpoch: now,
      } as any);
    });
  }

  watch$(id: string): Observable<Score | null> {
    const ref = doc(this.db as any, 'scores', id);
    return docData(ref, { idField: 'id' }).pipe(map(d => (d ? d as Score : null)));
  }
}