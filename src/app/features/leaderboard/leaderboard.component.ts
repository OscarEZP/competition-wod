// src/app/features/leaderboard/leaderboard.component.ts
import {
  Component, ElementRef, QueryList, ViewChildren, inject, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ScoreService } from '../../../core/services/score.service';
import { WodService } from '../../../core/services/wod.service';
import { Wod } from '../../../core/models/wod';
import { Score } from '../../../core/models/score';

type ScoringMode = 'time' | 'reps' | 'load';
type ScoreStatus = 'not_started' | 'running' | 'paused' | 'finished' | 'dnf';

interface RowVM {
  teamId: string;
  teamName: string;
  rank: number;
  points: number;
  detail: string;        // texto secundario según modo (tiempo/reps/carga)
  status: ScoreStatus;
  scoringMode: ScoringMode;
  finalTimeMs?: number | null;
  reps?: number | null;
  noReps?: number | null;
  maxLoadKg?: number | null;
}

@Component({
  standalone: true,
  selector: 'app-leaderboard',
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatProgressSpinnerModule],
  template: `
    <div class="wrap">
      <div class="filters">
        <mat-form-field appearance="outline" class="wod">
          <mat-label>WOD</mat-label>
          <mat-select [(ngModel)]="wodId" (selectionChange)="onSelectWod($event.value)">
            <mat-option *ngFor="let w of wods" [value]="w.id">
              {{ w.name }} — {{ w.category }} ({{ w.scoringMode }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div class="chip" *ngIf="currentWod as w">
          <span class="dot"></span>
          {{ w.name }} — {{ w.scoringMode }}
        </div>
      </div>

      <!-- Loading -->
      <div class="loading" *ngIf="loading">
        <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
      </div>

      <!-- Lista -->
      <div class="list" *ngIf="!loading && rows.length; else emptyTpl">
        <div
          *ngFor="let r of rows; trackBy: trackTeam"
          #rowEl
          class="card slide-in"
          [class.rank-1]="r.rank === 1"
          [class.rank-2]="r.rank === 2"
          [class.rank-3]="r.rank === 3"
          [class.rank-oth]="r.rank > 3"
          [attr.data-id]="r.teamId"
        >
          <!-- Sticker premio -->
          <div class="sticker" [ngClass]="{
              'st-1': r.rank===1,
              'st-2': r.rank===2,
              'st-3': r.rank===3
            }">
            <span class="medal" *ngIf="r.rank===1">🏆</span>
            <span class="medal" *ngIf="r.rank===2">🥈</span>
            <span class="medal" *ngIf="r.rank===3">🥉</span>
            <span class="ribbon"></span>
          </div>

          <!-- Posición -->
          <div class="pos">#{{ r.rank }}</div>

          <!-- Meta centrada -->
          <div class="meta meta-center">
            <div class="team">{{ r.teamName }}</div>
            <div class="detail">
              <span class="pill">
                {{ r.detail }}
              </span>
            </div>
          </div>

          <!-- Puntos -->
          <div class="points">
            <div class="pts">{{ r.points }}</div>
            <div class="pts-label">pts</div>
          </div>

          <!-- Sheen animado -->
          <span class="sheen" aria-hidden="true"></span>
        </div>
      </div>


      <ng-template #emptyTpl>
        <div class="empty">
          Selecciona un WOD para ver la clasificación.
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    :host { display:block; background:#fff; }
    .wrap { max-width: 980px; margin: 12px auto; padding: 12px; }
    .filters { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom: 10px; }
    .wod { min-width: 260px; }

    .chip {
      display:inline-flex; align-items:center; gap:8px;
      border-radius:999px; padding:6px 12px;
      background: rgba(252,85,0,0.06); color:#FC5500; font-weight:700;
    }
    .chip .dot { width:8px; height:8px; border-radius:50%; background:#FC5500; display:inline-block; }

    .loading { display:grid; place-items:center; padding: 24px; }

    /* Card grueso */
    .card {
      display:grid;
      grid-template-columns: auto 1fr auto;
      align-items:center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 16px;
      color: #fff;
      position: relative;
      overflow: hidden;
      transform-origin: center;
      will-change: transform;
      transition: box-shadow .18s ease;
    }
    .card:hover { box-shadow: 0 10px 28px rgba(0,0,0,.10); }

    .pos { font-weight: 900; font-size: 1.2rem; padding: 0 8px; }
    .meta .team { font-weight: 900; font-size: 1.05rem; line-height: 1.15; }
    .meta .detail { opacity: .95; font-size: .93rem; }
    .points { text-align:right; }
    .pts { font-weight: 900; font-size: 1.4rem; line-height:1; }
    .pts-label { font-size: .8rem; opacity:.9; }

    /* Colores + brillo podio */
    .rank-1 {
      background: linear-gradient(135deg, #FFD700, #E6C200);
      color: #4a3f00;
    }
    .rank-1::after {
      content: "";
      position: absolute; inset: -20%;
      background: radial-gradient(closest-side, rgba(255, 241, 153, 0.55), rgba(255,255,255,0) 70%);
      animation: glow 2.2s ease-in-out infinite;
      pointer-events: none;
    }

    .rank-2 {
      background: linear-gradient(135deg, #D9D9D9, #BFBFBF);
      color: #1f2937;
    }
    .rank-2::after {
      content: "";
      position: absolute; inset: -20%;
      background: radial-gradient(closest-side, rgba(236, 236, 236, 0.55), rgba(255,255,255,0) 70%);
      animation: glow 2.2s ease-in-out infinite;
      pointer-events: none;
    }

    .rank-3 {
      background: linear-gradient(135deg, #CD7F32, #B9712C);
      color: #1f2937;
    }
    .rank-3::after {
      content: "";
      position: absolute; inset: -20%;
      background: radial-gradient(closest-side, rgba(255, 199, 145, 0.45), rgba(255,255,255,0) 70%);
      animation: glow 2.2s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes glow {
      0%, 100% { opacity: .55; transform: scale(1); }
      50% { opacity: .75; transform: scale(1.03); }
    }

    .rank-oth {
      background: linear-gradient(135deg, #4063D8, #2D4FBF);
    }

    .empty {
      border: 1px solid #eee; border-radius: 14px; padding: 18px; text-align: center;
      color: #333;
    }

    /* Mobile-first */
    @media (max-width: 599px) {
      .wrap { margin: 0; padding: 10px; }
      .card { grid-template-columns: 1fr auto; }
      .pos { order: 1; }
      .meta { order: 2; }
      .points { order: 3; }
      .meta .team { font-size: 1rem; }
      .meta .detail { font-size: .9rem; }
    }

    /* Animación de aparición */
    .slide-in { animation: slideIn .22s ease-out both; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  
        /* ===== BASE ===== */
    .list { display:grid; gap:14px; }
    .card {
      position: relative;
      display:grid; grid-template-columns: auto 1fr auto;
      align-items:center; gap: 14px;
      padding: 18px 20px;
      border-radius: 22px;
      color: #fff; /* texto blanco en todas */
      overflow: hidden;
      box-shadow: 0 8px 26px rgba(0,0,0,.12);
      transform-origin: center;
      transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(0,0,0,.16); }

    .pos { font-weight: 900; font-size: 1.25rem; opacity: .95; padding: 0 8px; }
    .meta-center { text-align:center; }
    .meta .team {
      font-weight: 900;
      font-size: clamp(1.1rem, 4vw, 1.4rem);
      line-height: 1.1;
      letter-spacing: .2px;
    }
    .meta .detail { margin-top: 6px; }

    .pill {
      display:inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.18);
      backdrop-filter: blur(2px);
      font-weight: 700;
      font-size: .95rem;
    }

    .points { text-align:right; }
    .pts { font-weight: 900; font-size: 1.6rem; line-height:1; }
    .pts-label { font-size: .8rem; opacity:.9; }

    /* ===== PODIO CON BRILLO & GRADIENTS ===== */
    .rank-1 {
      background: linear-gradient(160deg, #FFD700 0%, #F6C60B 40%, #E6B800 100%);
      filter: saturate(1.05);
    }
    .rank-2 {
      background: linear-gradient(160deg, #ECECEC 0%, #D3D3D3 45%, #BEBEBE 100%);
    }
    .rank-3 {
      background: linear-gradient(160deg, #D28A45 0%, #C17734 45%, #B1692B 100%);
    }
    /* Resto */
    .rank-oth {
      background: linear-gradient(160deg, #4766E7 0%, #2F52D2 50%, #2748B9 100%);
    }

    /* Sheen (destello diagonal animado) */
    .sheen {
      position:absolute; top:-30%; left:-30%;
      width: 60%; height: 200%;
      transform: rotate(20deg);
      background: linear-gradient(90deg,
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,.22) 45%,
        rgba(255,255,255,0) 100%);
      animation: sheenMove 2.8s ease-in-out infinite;
      mix-blend-mode: screen;
      pointer-events: none;
    }
    @keyframes sheenMove {
      0%   { transform: translateX(-120%) rotate(20deg); opacity:.0; }
      20%  { opacity:.7; }
      50%  { transform: translateX(150%) rotate(20deg); opacity:.0; }
      100% { transform: translateX(150%) rotate(20deg); opacity:.0; }
    }

    /* ===== STICKER (medalla + cinta) ===== */
    .sticker {
      position:absolute; top:10px; left:10px; z-index: 2;
      width: 54px; height: 54px; border-radius: 50%;
      display:grid; place-items:center;
      box-shadow: 0 6px 14px rgba(0,0,0,.18);
    }
    .st-1 { background: radial-gradient(circle at 35% 35%, #FFF6B0, #F3C300); }
    .st-2 { background: radial-gradient(circle at 35% 35%, #FFFFFF, #CFCFCF); }
    .st-3 { background: radial-gradient(circle at 35% 35%, #FFD7A6, #C2772E); }

    .medal { font-size: 1.35rem; filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
    .ribbon {
      position:absolute; bottom:-10px; left:50%; transform: translateX(-50%);
      width: 10px; height: 16px; border-radius: 2px;
      background: rgba(0,0,0,.25);
      clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
      opacity:.5;
    }

    /* ===== MOBILE-FIRST ===== */
    @media (max-width: 599px) {
      .wrap { margin: 0; padding: 10px; }
      .card { grid-template-columns: 1fr auto; padding: 16px 16px 18px; }
      .pos { order: 2; font-size: 1.1rem; padding: 0; }
      .meta { order: 1; }
      .points { order: 3; }
      .sticker { width: 48px; height: 48px; top: 8px; left: 8px; }
    }

    /* ===== FLIP (ya lo tienes en TS) – opcional realce subida/bajada ===== */
    .card.moved-up    { box-shadow: 0 10px 28px rgba(76, 175, 80, .35) !important; }
    .card.moved-down  { box-shadow: 0 10px 28px rgba(244, 67, 54, .35) !important; }

  
    `]
})
export class LeaderboardComponent {
  private scoreSvc = inject(ScoreService);
  private wodsSvc = inject(WodService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  wods: Wod[] = [];
  currentWod: Wod | null = null;
  wodId = '';

  loading = false;

  rows: RowVM[] = [];

  // --- FLIP animation refs ---
  @ViewChildren('rowEl') rowEls!: QueryList<ElementRef<HTMLElement>>;
  private prevTops = new Map<string, number>();     // teamId -> top (px)
  private prevOrder = new Map<string, number>();    // teamId -> prev index

  constructor() {
    // Carga de WODs
    this.wodsSvc.listAll$().subscribe(ws => {
      this.wods = ws || [];
      if (!this.wodId && this.wods.length) {
        this.wodId = this.wods[0].id;
        this.onSelectWod(this.wodId);
      }
    });
  }

  trackTeam = (_: number, r: RowVM) => r.teamId;

  onSelectWod(id: string) {
    this.wodId = id;
    this.currentWod = this.wods.find(w => w.id === id) || null;
    if (!this.currentWod) { this.rows = []; return; }

    this.loading = true;

    // Suscripción live de scores del WOD
    this.scoreSvc.listForWod$(this.wodId).subscribe(scores => {
      // Captura posiciones previas antes de cambiar DOM
      this.capturePositions();

      // Ordena y proyecta a VM
      const mode = (this.currentWod?.scoringMode as ScoringMode) || 'time';
      const ordered = this.sortScores(scores || [], mode);
      const next = ordered.map((s, i) => this.toRowVM(s, i + 1, mode));

      // Aplica cambios
      this.rows = next;
      this.loading = false;

      // After render: animar reorden (FLIP)
      // esperamos al próximo frame en la zona de Angular
      this.ngZone.runOutsideAngular(() => {
        requestAnimationFrame(() => this.playFLIP());
      });
      this.cdr.markForCheck();
    });
  }

  // ---- Proyección y lógica de negocio ----
  private toRowVM(s: Score, rank: number, mode: ScoringMode): RowVM {
    return {
      teamId: s.teamId!,
      teamName: s.teamName!,
      rank,
      points: this.awardPointsByRank(rank),
      detail: this.buildDetail(s, mode),
      status: (s.status as ScoreStatus) || 'not_started',
      scoringMode: mode,
      finalTimeMs: s.finalTimeMs ?? null,
      reps: s.reps ?? null,
      noReps: s.noReps ?? null,
      maxLoadKg: s.maxLoadKg ?? null,
    };
  }

  private sortScores(scores: Score[], mode: ScoringMode): Score[] {
    const clone = [...scores];
    for (const s of clone) {
      (s as any).finalTimeMs = s.finalTimeMs ?? null;
      (s as any).reps = s.reps ?? 0;
      (s as any).noReps = s.noReps ?? 0;
      (s as any).maxLoadKg = s.maxLoadKg ?? 0;
    }
    return clone.sort((a, b) => {
      if (mode === 'time') {
        const aFinished = a.status === 'finished' && typeof a.finalTimeMs === 'number';
        const bFinished = b.status === 'finished' && typeof b.finalTimeMs === 'number';
        if (aFinished && bFinished) {
          if (a.finalTimeMs! !== b.finalTimeMs!) return a.finalTimeMs! - b.finalTimeMs!;
          if (a.reps! !== b.reps!) return b.reps! - a.reps!;
          return (a.noReps ?? 0) - (b.noReps ?? 0);
        }
        if (aFinished !== bFinished) return aFinished ? -1 : 1;
        if ((a.reps ?? 0) !== (b.reps ?? 0)) return (b.reps ?? 0) - (a.reps ?? 0);
        return (a.noReps ?? 0) - (b.noReps ?? 0);
      }
      if (mode === 'reps') {
        if ((a.reps ?? 0) !== (b.reps ?? 0)) return (b.reps ?? 0) - (a.reps ?? 0);
        if ((a.noReps ?? 0) !== (b.noReps ?? 0)) return (a.noReps ?? 0) - (b.noReps ?? 0);
        return this.stateOrder(a.status as ScoreStatus) - this.stateOrder(b.status as ScoreStatus);
      }
      // load
      if ((a.maxLoadKg ?? 0) !== (b.maxLoadKg ?? 0)) return (b.maxLoadKg ?? 0) - (a.maxLoadKg ?? 0);
      if ((a.noReps ?? 0) !== (b.noReps ?? 0)) return (a.noReps ?? 0) - (b.noReps ?? 0);
      return this.stateOrder(a.status as ScoreStatus) - this.stateOrder(b.status as ScoreStatus);
    });
  }

  private stateOrder(s: ScoreStatus): number {
    switch (s) {
      case 'finished': return 0;
      case 'paused': return 1;
      case 'running': return 2;
      case 'not_started': return 3;
      case 'dnf': return 4;
      default: return 5;
    }
  }

  private awardPointsByRank(rank: number): number {
    return Math.max(5, 100 - (rank - 1) * 5);
  }

  private msToClock(ms: number) {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
  }

  private buildDetail(s: Score, mode: ScoringMode): string {
    if (mode === 'time') {
      const time = (s.status === 'finished' && typeof s.finalTimeMs === 'number')
        ? this.msToClock(s.finalTimeMs!)
        : (s.status === 'dnf' ? 'DNF' : '—');
      return `Tiempo: ${time} • Reps: ${s.reps ?? 0} • No-reps: ${s.noReps ?? 0}`;
    }
    if (mode === 'reps') {
      const tag = s.status === 'dnf' ? ' • DNF' : '';
      return `Reps: ${s.reps ?? 0} • No-reps: ${s.noReps ?? 0}${tag}`;
    }
    // load
    const tag = s.status === 'dnf' ? ' • DNF' : '';
    return `Máx: ${s.maxLoadKg ?? 0} kg${tag}`;
  }

  // ---- FLIP: captura y animación de reorden ----
  private capturePositions() {
    if (!this.rowEls) return;
    this.prevTops.clear();
    this.prevOrder.clear();
    this.rowEls.forEach((ref, idx) => {
      const el = ref.nativeElement as HTMLElement;
      const id = el.getAttribute('data-id') || `${idx}`;
      this.prevTops.set(id, el.getBoundingClientRect().top);
      this.prevOrder.set(id, idx);
    });
  }

  private playFLIP() {
    if (!this.rowEls) return;
    this.rowEls.forEach((ref, newIdx) => {
      const el = ref.nativeElement as HTMLElement;
      const id = el.getAttribute('data-id') || `${newIdx}`;
      const prevTop = this.prevTops.get(id);
      if (prevTop == null) return;

      const newTop = el.getBoundingClientRect().top;
      const dy = prevTop - newTop;
      if (dy === 0) return;

      // FLIP
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      el.getBoundingClientRect(); // reflow
      el.style.transition = 'transform 260ms cubic-bezier(.2,.7,.2,1)';
      el.style.transform = 'translateY(0)';

      // opcional: resaltar cambio de posición
      const prevPos = (this.prevOrder.get(id) ?? newIdx) + 1;
      const newPos = newIdx + 1;
      if (prevPos !== newPos) {
        const up = newPos < prevPos;
        el.animate(
          [{ boxShadow: '0 0 0 rgba(0,0,0,0)' },
           { boxShadow: up ? '0 8px 22px rgba(76, 175, 80, .35)' : '0 8px 22px rgba(244, 67, 54, .35)' },
           { boxShadow: '0 0 0 rgba(0,0,0,0)' }],
          { duration: 400, easing: 'ease-out' }
        );
      }
    });
  }
}
