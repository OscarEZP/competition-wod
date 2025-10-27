// src/app/features/home/home.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay, startWith, take } from 'rxjs/operators';
import { firstValueFrom, Observable } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { Wod } from '../../core/models/wod';
import { WodService } from '../../core/services/wod.service';
import { TeamService } from '../../core/services/team.service';
import { ScoreService } from '../../core/services/score.service';
import { AppHeaderComponent } from '../shared/ui/app-header.component';
import { AppSideMenuComponent } from '../shared/ui/app-side-menu.component';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatSidenavModule, MatCardModule, MatChipsModule, MatButtonModule, MatIconModule, MatDividerModule, MatSnackBarModule,
    AppHeaderComponent, AppSideMenuComponent
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <!-- Lateral -->
      <mat-sidenav
        #drawer
        class="side"
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="!(isHandset$ | async)"
      >
        <ng-container *ngIf="auth.appUser$ | async as user; else guest">
          <app-side-menu
            [user]="user"
            (logout)="logout()"
            (item)="closeOnMobile(drawer)">
          </app-side-menu>
        </ng-container>

        <ng-template #guest>
          <app-side-menu
            [user]="null"
            (item)="closeOnMobile(drawer)">
          </app-side-menu>
        </ng-template>
      </mat-sidenav>

      <!-- Contenido -->
      <mat-sidenav-content class="content">
        <app-header
          [title]="'Dashboard'"
          (menu)="drawer.toggle()">
        </app-header>

        <!-- Main -->
        <main class="main">
          <h1 class="page-title">WODs</h1>

          <!-- Grid de cards -->
          <section class="wods-grid" *ngIf="wods$ | async as wods; else loadingTpl">
            <mat-card class="wod-card" *ngFor="let w of wods; trackBy: trackById">
              <mat-card-header> 
                <div mat-card-avatar class="avatar">W</div>
                <mat-card-title class="wod-title">{{ w.name }}</mat-card-title>
                <mat-card-subtitle class="wod-sub">
                  <mat-chip-set aria-label="Etiquetas">
                    <mat-chip class="chip cat" disableRipple>{{ w.category }}</mat-chip>
                    <mat-chip class="chip score" disableRipple>{{ w.scoringMode | titlecase }}</mat-chip>
                  </mat-chip-set>
                </mat-card-subtitle>

                <mat-chip class="chip state" [ngClass]="statusClass(w)" disableRipple>
                  {{ statusLabel(w) }}
                </mat-chip>
              </mat-card-header>

              <mat-card-content class="wod-body">
                <div class="desc" *ngIf="w.description">{{ w.description }}</div>

                <div class="blocks">
                  <h4 class="blocks-title">Bloques</h4>
                  <ol class="block-list">
                    <li class="block-item" *ngFor="let b of blocksOf(w); index as i">
                      <div class="block-head">
                        <strong class="b-type">{{ (b?.type || '').toUpperCase() }}</strong>

                        <span class="dot" *ngIf="b?.type==='amrap' || b?.type==='emom'">•</span>
                        <span class="b-meta" *ngIf="(b?.type==='amrap' || b?.type==='emom') && b['minutes']">
                          Duración: {{ b['minutes'] }} min
                        </span>

                        <span class="dot" *ngIf="(b?.type==='for_time' || b?.type==='chipper' || b?.type==='benchmark') && b['capSeconds']">•</span>
                        <span class="b-meta" *ngIf="(b?.type==='for_time' || b?.type==='chipper' || b?.type==='benchmark') && b['capSeconds']">
                          Cap: {{ b['capSeconds'] }} s
                        </span>

                        <span class="dot" *ngIf="b?.type==='interval' && (b['rounds'] || (b['workSeconds'] && b['restSeconds']))">•</span>
                        <span class="b-meta" *ngIf="b?.type==='interval' && b['rounds']">Rondas: {{ b['rounds'] }}</span>
                        <span class="b-meta" *ngIf="b?.type==='interval' && b['workSeconds'] && b['restSeconds']">
                          Trabajo/Descanso: {{ b['workSeconds'] }}s / {{ b['restSeconds'] }}s
                        </span>

                        <span class="dot" *ngIf="b?.type==='for_load' && (b['liftType'] || b['attempts'])">•</span>
                        <span class="b-meta" *ngIf="b?.type==='for_load' && b['liftType']">Levantamiento: {{ b['liftType'] }}</span>
                        <span class="b-meta" *ngIf="b?.type==='for_load' && b['attempts']">Intentos: {{ b['attempts'] }}</span>
                      </div>

                      <ng-container *ngIf="b?.movements?.length">
                        <ul class="mv-list">
                          <li class="mv" *ngFor="let m of b['movements']">
                            <span class="mv-name">{{ m.name }}</span>
                            <span class="mv-meta" *ngIf="m.reps">&nbsp;— {{ m.reps }} reps</span>
                            <span class="mv-meta" *ngIf="m.loadKg">&nbsp;• {{ m.loadKg }} kg</span>
                            <span class="mv-meta note" *ngIf="m.notes">&nbsp;• {{ m.notes }}</span>
                          </li>
                        </ul>
                      </ng-container>

                      <ng-container *ngIf="b?.type==='emom' && b?.perMinute?.length">
                        <div class="emom">
                          <div class="emom-title">Por minuto:</div>
                          <ul class="mv-list">
                            <li class="mv" *ngFor="let m of b['perMinute']">
                              <span class="mv-name">{{ m.name }}</span>
                              <span class="mv-meta" *ngIf="m.reps">&nbsp;— {{ m.reps }} reps</span>
                              <span class="mv-meta" *ngIf="m.loadKg">&nbsp;• {{ m.loadKg }} kg</span>
                              <span class="mv-meta note" *ngIf="m.notes">&nbsp;• {{ m.notes }}</span>
                            </li>
                          </ul>
                        </div>
                      </ng-container>
                    </li>
                  </ol>
                </div>
              </mat-card-content>

              <mat-card-actions class="wod-actions">
                <a mat-stroked-button color="primary"
                  class="btn action-leaderboard"
                  [routerLink]="['/leaderboard']"
                  [queryParams]="{ wod: w.id }">
                  <mat-icon>emoji_events</mat-icon>
                  <span>Ver leaderboard</span>
                </a>

                <a mat-button color="primary"
                  class="btn action-judge"
                  [routerLink]="['/judge']"
                  *ngIf="isAdminOrJudge$ | async">
                  <mat-icon>gavel</mat-icon>
                  <span>Juzgar este WOD</span>
                </a>

                <ng-container *ngIf="isAdmin$ | async">
                  <ng-container *ngIf="heatOf(w.id) | async as heat">
                    <button mat-raised-button class="btn btn-start"
                            (click)="startAll(w.id, w.category)"
                            *ngIf="heat.status!=='running'">
                      <mat-icon>play_arrow</mat-icon>
                      <span>Iniciar WOD</span>
                    </button>

                    <button mat-raised-button class="btn btn-finish"
                            (click)="finishAll(w.id, w.category)"
                            *ngIf="heat.status==='running'">
                      <mat-icon>stop</mat-icon>
                      <span>Finalizar WOD</span>
                    </button>
                  </ng-container>
                </ng-container>

                <div class="heat-timer" *ngIf="heatOf(w.id) | async as heat">
                  <span class="time" [class.pulse]="heat.status==='running'">
                    {{ heat.status==='running'
                        ? fmtClock(nowTick() - (heat.startedAt || nowTick()))
                        : fmtClock(heat.finalTimeMs || 0) }}
                  </span>
                  <span class="badge badge-running" *ngIf="heat.status==='running'">EN CURSO</span>
                  <span class="badge badge-finished" *ngIf="heat.status==='finished'">FINALIZADO</span>
                </div>
              </mat-card-actions>
            </mat-card>
          </section>

          <ng-template #loadingTpl>
            <p class="muted">Cargando WODs…</p>
          </ng-template>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .layout-container { height: 100dvh; background: #fff; }
    .side { width: 280px; border-right: 1px solid #eee; display:flex; flex-direction:column; }
    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding: 16px; display:grid; gap:16px; width:100%; max-width: 1400px; margin-inline:auto; }
    .page-title { margin:0; font-size: clamp(1.2rem, 2.6vw, 1.6rem); font-weight:900; }

    .wods-grid { display:grid; grid-template-columns: minmax(0,1fr); gap: 16px; width:100%; }
    @media (min-width: 720px) { .wods-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (min-width: 1200px) { .wods-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }

    .wod-card { border:1px solid #eee; border-radius:16px; overflow:hidden; background:#fff; }
    .avatar { background:#FC5500; color:#fff; border-radius:8px; display:grid; place-items:center; font-weight:800; }
    .wod-title { font-weight:900; }
    .wod-sub { margin-top: 4px; }
    .chip { font-weight:700; }
    .chip.cat { background: rgba(252,85,0,.08); color:#FC5500; }
    .chip.score { background:#f3f4f6; color:#374151; }

    .wod-body { display:grid; gap:10px; }
    .desc { color:#4b5563; }
    .blocks-title { margin: 4px 0 2px; font-weight:800; color:#111; }
    .block-list { margin: 0; padding-left: 18px; display:grid; gap:10px; }
    .block-item { border:1px dashed #ececec; border-radius:12px; padding:10px; }
    .block-head { display:flex; flex-wrap:wrap; gap:6px; align-items:center; color:#1f2937; }
    .b-type { color:#FC5500; }
    .b-meta { color:#6b7280; }
    .dot { opacity:.6; }

    .mv-list { margin: 6px 0 0; padding-left: 16px; display:grid; gap:4px; }
    .mv { color:#374151; }
    .mv-name { font-weight:600; }
    .mv .note { color:#6b7280; font-style: italic; }
    .emom-title { font-weight:700; margin-top: 6px; }

    .wod-actions { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 12px 16px 16px; }
    .wod-actions .btn { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; border-radius: 12px; text-align: center; min-height: 44px; }
    .btn-start { background: #10b981; color: #fff; box-shadow: 0 4px 10px rgba(16,185,129,.25); }
    .btn-start:hover { background: #0ea371; }
    .btn-start:disabled { background: #a7f3d0; color: #fff; }
    .btn-finish { background: #ef4444; color: #fff; box-shadow: 0 4px 10px rgba(239,68,68,.25); }
    .btn-finish:hover { background: #dc2626; }
    .btn-finish:disabled { background: #fecaca; color: #fff; }

    .action-leaderboard { border-width: 2px; border-radius: 12px; font-weight: 800; }
    .action-judge { background: rgba(252,85,0,.08); color: #FC5500; border-radius: 12px; }

    @media (min-width: 720px) {
      .wod-actions { grid-template-columns: repeat(4, minmax(0,1fr)); }
      .wod-actions .btn,
      .wod-actions .action-leaderboard,
      .wod-actions .action-judge { width: 100%; }
    }

    .mat-card-actions { overflow-x: clip; }

    .heat-timer { display:flex; align-items:center; gap:10px; margin: 8px 16px 0; }
    .heat-timer .time {
      font-weight: 900; font-variant-numeric: tabular-nums;
      font-size: clamp(20px, 4.2vw, 28px);
      color:#FC5500; background: rgba(252,85,0,0.06);
      border-radius: 12px; padding: 6px 10px;
    }
    .heat-timer .time.pulse { animation: pulse 1.6s ease-in-out infinite; }
    .badge { padding: 4px 10px; border-radius: 999px; font-weight: 800; color:#fff; font-size: .82rem; letter-spacing: .3px; }
    .badge-running  { background: #FC5500; }
    .badge-finished { background: #10b981; }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
  `]
})
export class HomeComponent {
  auth = inject(AuthService);
  private snack   = inject(MatSnackBar);
  private teamSvc = inject(TeamService);
  private scoreSvc = inject(ScoreService);
  private bpo = inject(BreakpointObserver);
  private wodSvc = inject(WodService);

  private _timer?: any;
  nowTick = signal(Date.now());

  constructor() {
    this._timer = setInterval(() => this.nowTick.set(Date.now()), 100);
  }
  ngOnDestroy() { clearInterval(this._timer); }

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  wods$: Observable<Wod[]> = this.wodSvc.listAll$();

  // ==== Helpers originales ====
  fmtClock(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
  }
  blocksOf(w: Wod): any[] { return (w as any)?.blocks ?? []; }

  isAdminOrJudge$ = this.auth.appUser$.pipe(
    map(u => !!u && (u.role === 'admin' || u.role === 'judge')),
    shareReplay(1)
  );
  isAdmin$ = this.auth.appUser$.pipe(
    map(u => !!u && u.role === 'admin'),
    shareReplay(1)
  );

  trackById = (_: number, w: Wod) => (w as any).id;

  logout() { this.auth.logout(); }

  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }

  private heatCache = new Map<string, Observable<{status:'scheduled'|'running'|'finished', startedAt?:number|null, finalTimeMs?:number|null}>>();
  heatOf(wodId: string) {
    if (!this.heatCache.has(wodId)) {
      const obs = this.scoreSvc.listForWod$(wodId).pipe(
        startWith([] as any[]),
        map(scores => {
          if (!scores?.length) return { status: 'scheduled' as const, startedAt: null, finalTimeMs: null };
          const running = scores.filter(s => s.status === 'running' && !!s.startedAt);
          if (running.length) {
            const minStart = Math.min(...running.map(s => Number(s.startedAt)));
            return { status: 'running' as const, startedAt: minStart, finalTimeMs: null };
          }
          const finished = scores.filter(s => s.status === 'finished' && s.finalTimeMs != null);
          if (finished.length) {
            const maxFinal = Math.max(...finished.map(s => Number(s.finalTimeMs)));
            return { status: 'finished' as const, startedAt: null, finalTimeMs: maxFinal };
          }
          return { status: 'scheduled' as const, startedAt: null, finalTimeMs: null };
        }),
        shareReplay(1)
      );
      this.heatCache.set(wodId, obs);
    }
    return this.heatCache.get(wodId)!;
  }

  async startAll(wodId: string, category: 'RX'|'Intermedio') {
    const scores = await firstValueFrom(this.scoreSvc.listForWod$(wodId).pipe(take(1)));
    const targets = scores.filter(s => s.category === category);
    const masterStartedAt = Date.now();
    for (const s of targets) {
      await this.scoreSvc.start(s.id, masterStartedAt);
    }
  }

  async finishAll(wodId: string, category: 'RX'|'Intermedio') {
    const scores = await firstValueFrom(this.scoreSvc.listForWod$(wodId).pipe(take(1)));
    const targets = scores.filter(s => s.category === category);
    const masterFinishedAt = Date.now();
    for (const s of targets) {
      const elapsed = (s.startedAt != null) ? (masterFinishedAt - s.startedAt) : null;
      await this.scoreSvc.finish(s.id, elapsed);
    }
  }

  statusOf(w: Wod): 'scheduled' | 'running' | 'finished' {
    const s = (w as any)?.status;
    return s === 'running' || s === 'finished' ? s : 'scheduled';
  }
  statusClass(w: Wod) {
    const s = this.statusOf(w);
    return { 'st-scheduled': s === 'scheduled', 'st-running': s === 'running', 'st-finished': s === 'finished' };
  }
  statusLabel(w: Wod) {
    const s = this.statusOf(w);
    return s === 'running' ? 'En curso' : s === 'finished' ? 'Finalizado' : 'Programado';
  }
}
