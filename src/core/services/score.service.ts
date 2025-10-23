import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, collectionData, doc,
  updateDoc, deleteDoc, docData, query, where, orderBy, setDoc
} from '@angular/fire/firestore';
import { runTransaction, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { Score } from '../models/score';
import { AuthService } from './auth.service';

const BIG = 100000; // penalizador para DNF/ties en 'time'

@Injectable({ providedIn: 'root' })
export class ScoreService {
  private db = inject(Firestore);
  private auth = inject(AuthService);
  private col = collection(this.db, 'scores');

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
    const ref = doc(this.db, 'scores', id);
    return docData(ref, { idField: 'id' }).pipe(map(d => (d ? d as Score : null)));
  }

  // ======= Helpers =======
  scoreId(wodId: string, teamId: string, category: 'RX'|'Intermedio') {
    return `${wodId}__${teamId}__${category}`;
  }

  private stripUndefined(obj: any) {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(k => {
        const v = obj[k];
        if (v === undefined) delete obj[k];
        else if (Array.isArray(v)) v.forEach(x => this.stripUndefined(x));
        else if (typeof v === 'object') this.stripUndefined(v);
      });
    }
  }

  /**
   * Reglas de ranking:
   * - time: menor tiempo gana; si no terminó/ DNF -> capMs + (BIG - reps)
   * - reps: mayor reps gana => rankPrimary = -reps
   * - load: mayor carga gana; empate por reps => rankPrimary = -(maxLoadKg*1000 + reps)
   */
  computeRanks(opts: {
    scoringMode: 'time'|'reps'|'load',
    finalTimeMs?: number | null,
    capSeconds?: number | null,
    finished?: boolean,
    dnf?: boolean,
    reps: number,
    maxLoadKg?: number | null,
  }): { rankPrimary: number, rankSecondary: number } {
    const { scoringMode, finalTimeMs, capSeconds, finished, reps, maxLoadKg } = opts;

    if (scoringMode === 'time') {
      const capMs = (capSeconds ?? 0) * 1000;
      if (finished && finalTimeMs != null) {
        return { rankPrimary: finalTimeMs, rankSecondary: 0 };
      }
      // Mientras corre o DNF: ordena por reps (más reps => mejor)
      const penalty = BIG - (reps || 0);
      return { rankPrimary: capMs + penalty, rankSecondary: 0 };
    }

    if (scoringMode === 'reps') {
      return { rankPrimary: -(reps || 0), rankSecondary: 0 };
    }

    // load
    const loadVal = Math.round(((maxLoadKg ?? 0) * 1000) + Math.max(0, reps || 0));
    return { rankPrimary: -loadVal, rankSecondary: 0 };
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
    const ref = doc(this.db, 'scores', id);
    const user = this.auth.currentUser;

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
      startedAt: null,
      finalTimeMs: null,
      capSeconds: args.capSeconds ?? null,
      rankPrimary: this.computeRanks({
        scoringMode: args.scoringMode,
        finalTimeMs: null,
        capSeconds: args.capSeconds ?? null,
        finished: false,
        reps: 0,
        maxLoadKg: null,
      }).rankPrimary,
      rankSecondary: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      judgeId: user?.uid || null,
    };

    this.stripUndefined(base);
    await setDoc(ref, base, { merge: true });
    return id;
  }

  // ======= Acciones en tiempo real =======

  /** Incrementa reps en transacción y recalcula ranking inmediatamente */
  async incrementReps(scoreId: string, by: number = 1) {
    await runTransaction(this.db as any, async (trx) => {
      const ref = doc(this.db, 'scores', scoreId);
      const snap = await trx.get(ref as any);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      const reps = (data.reps || 0) + by;
      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: data.finalTimeMs ?? null,
        capSeconds: data.capSeconds ?? null,
        finished: data.status === 'finished',
        reps,
        maxLoadKg: data.maxLoadKg ?? null,
      });

      trx.update(ref as any, {
        reps,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: Date.now(),
      } as any);
    });
  }

  /** Incrementa no-reps (no afecta el ranking directamente) */
  async incrementNoReps(scoreId: string, by: number = 1) {
    const ref = doc(this.db, 'scores', scoreId);
    await updateDoc(ref, {
      noReps: increment(by),
      updatedAt: Date.now()
    } as any);
  }

  /** Guarda intento de carga y recomputa ranking */
  async addLoadAttempt(scoreId: string, loadKg: number) {
    await runTransaction(this.db as any, async (trx) => {
      const ref = doc(this.db, 'scores', scoreId);
      const snap = await trx.get(ref as any);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      const attempts = Array.isArray(data.attempts) ? [...data.attempts] : [];
      attempts.push({ at: Date.now(), loadKg, success: true });

      const maxLoad = Math.max(loadKg, data.maxLoadKg ?? 0);

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: data.finalTimeMs ?? null,
        capSeconds: data.capSeconds ?? null,
        finished: data.status === 'finished',
        reps: data.reps || 0,
        maxLoadKg: maxLoad,
      });

      trx.update(ref as any, {
        attempts,
        maxLoadKg: maxLoad,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: Date.now(),
      } as any);
    });
  }

  /** Marca inicio del timer */
  async start(scoreId: string) {
    const ref = doc(this.db, 'scores', scoreId);
    await updateDoc(ref, {
      status: 'running',
      startedAt: Date.now(),
      finalTimeMs: null,
      updatedAt: Date.now(),
    } as any);
  }

  /** Marca stop (guarda finalTimeMs) — no finaliza todavía */
  async stop(scoreId: string) {
    await runTransaction(this.db as any, async (trx) => {
      const ref = doc(this.db, 'scores', scoreId);
      const snap = await trx.get(ref as any);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      if (!data.startedAt) return; // nada que medir
      const finalTimeMs = Date.now() - data.startedAt;

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs,
        capSeconds: data.capSeconds ?? null,
        finished: false, // aún no finalizado
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      });

      trx.update(ref as any, {
        finalTimeMs,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: Date.now(),
      } as any);
    });
  }

  /** Finaliza (bloquea el tiempo si aplica y recalcula ranking como 'finished') */
  async finish(scoreId: string) {
    await runTransaction(this.db as any, async (trx) => {
      const ref = doc(this.db, 'scores', scoreId);
      const snap = await trx.get(ref as any);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      let finalTimeMs = data.finalTimeMs ?? null;
      if (data.scoringMode === 'time' && data.startedAt && finalTimeMs == null) {
        finalTimeMs = Date.now() - data.startedAt;
      }

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs,
        capSeconds: data.capSeconds ?? null,
        finished: true,
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      });

      trx.update(ref as any, {
        status: 'finished',
        finalTimeMs,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: Date.now(),
      } as any);
    });
  }

  /** Marca DNF y recalcula ranking (usa reps para ordenar DNFs en 'time') */
  async markDNF(scoreId: string) {
    await runTransaction(this.db as any, async (trx) => {
      const ref = doc(this.db, 'scores', scoreId);
      const snap = await trx.get(ref as any);
      if (!snap.exists()) throw new Error('Score no encontrado');
      const data = snap.data() as Score;

      const ranks = this.computeRanks({
        scoringMode: data.scoringMode,
        finalTimeMs: null,
        capSeconds: data.capSeconds ?? null,
        finished: false,
        reps: data.reps || 0,
        maxLoadKg: data.maxLoadKg ?? null,
      });

      trx.update(ref as any, {
        status: 'dnf',
        finalTimeMs: null,
        rankPrimary: ranks.rankPrimary,
        rankSecondary: ranks.rankSecondary,
        updatedAt: Date.now(),
      } as any);
    });
  }

  watch$(id: string): Observable<Score | null> {
    const ref = doc(this.db, 'scores', id);
    return docData(ref, { idField: 'id' }).pipe(map(d => (d ? d as Score : null)));
  }
}
