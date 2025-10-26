import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay, startWith, take } from 'rxjs/operators';
import { firstValueFrom, Observable } from 'rxjs';
import { MatMenuModule }      from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule }  from '@angular/material/snack-bar';

import { Wod } from '../../core/models/wod';
import { Category, Team } from '../../core/models/team';
import { WodService } from '../../core/services/wod.service';
import { TeamService } from '../../core/services/team.service';
import { ScoreService } from '../../core/services/score.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatToolbarModule, MatSidenavModule, MatListModule, MatDividerModule,
    MatCardModule, MatChipsModule,
    MatMenuModule, MatSnackBarModule
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
        <div class="side-header">
          <div class="brand">CF</div>
          <div class="brand-txt">
            <strong>CrossFit</strong>
            <span>Competition</span>
          </div>
        </div>

        <!-- Usuario autenticado -->
        <ng-container *ngIf="(auth.appUser$ | async) as user; else guestMenu">
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>

            <a mat-list-item routerLink="/leaderboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>leaderboard</mat-icon>
              <span matListItemTitle>Tablero</span>
            </a>

            <a mat-list-item routerLink="/my-team" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>group</mat-icon>
              <span matListItemTitle>Mi equipo</span>
            </a>

            <!-- Bloque Administración (solo admins) -->
            <ng-container *ngIf="user.role === 'admin'">
              <mat-divider></mat-divider>
              <div mat-subheader class="subheader">Administración</div>

              <a mat-list-item routerLink="/admin/wods" routerLinkActive="active" (click)="closeOnMobile(drawer)">
                <mat-icon matListItemIcon>fitness_center</mat-icon>
                <span matListItemTitle>Admin WODs</span>
              </a>

              <a mat-list-item routerLink="/admin/teams" routerLinkActive="active" (click)="closeOnMobile(drawer)">
                <mat-icon matListItemIcon>groups</mat-icon>
                <span matListItemTitle>Admin Teams</span>
              </a>

              <a mat-list-item routerLink="/admin" routerLinkActive="active" (click)="closeOnMobile(drawer)">
                <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
                <span matListItemTitle>Panel Admin</span>
              </a>
            </ng-container>

            <!-- Panel Juez -->
            <a *ngIf="user.role === 'admin' || user.role === 'judge'"
               mat-list-item routerLink="/judge" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>gavel</mat-icon>
              <span matListItemTitle>Panel Juez</span>
            </a>

            <mat-divider></mat-divider>

            <button mat-list-item (click)="logout(); closeOnMobile(drawer)">
              <mat-icon matListItemIcon>logout</mat-icon>
              <span matListItemTitle>Salir</span>
            </button>
          </mat-nav-list>

          <div class="side-footer">
            <div class="user">
              <mat-icon>account_circle</mat-icon>
              <div class="meta">
                <div class="name">{{ user.displayName || user.email }}</div>
                <div class="role">Rol: {{ user.role }}</div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Invitado -->
        <ng-template #guestMenu>
          <mat-nav-list>
            <a mat-list-item routerLink="/auth/login" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>login</mat-icon>
              <span matListItemTitle>Entrar</span>
            </a>
            <a mat-list-item routerLink="/auth/register" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>person_add</mat-icon>
              <span matListItemTitle>Crear cuenta</span>
            </a>
          </mat-nav-list>
        </ng-template>
      </mat-sidenav>

      <!-- Contenido -->
      <mat-sidenav-content class="content">
        <!-- Header fijo -->
        <mat-toolbar class="app-toolbar" color="primary">
          <button
            type="button"
            mat-icon-button
            aria-label="Abrir menú"
            (click)="drawer.toggle()"
            class="only-handset"
          >
            <mat-icon>menu</mat-icon>
          </button>

          <div class="toolbar-title">
            <span class="logo">CF</span>
            <span class="title">Dashboard</span>
          </div>

          <span class="spacer"></span>

          <div class="toolbar-actions hide-handset">
            <a mat-button routerLink="/dashboard">Dashboard</a>
            <a mat-button routerLink="/leaderboard">Tablero</a>
            <a mat-button routerLink="/my-team">Mi equipo</a>
          </div>
        </mat-toolbar>

        <!-- Main -->
        <main class="main">
          <h1 class="page-title">WODs</h1>

          <!-- Grid de cards -->
          <section class="wods-grid" *ngIf="wods$ | async as wods; else loadingTpl">
            <mat-card class="wod-card" *ngFor="let w of wods; trackBy: trackById">
              <!-- Header -->
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

              <!-- Body / Detalle completo -->
              <mat-card-content class="wod-body">
                <div class="desc" *ngIf="w.description">{{ w.description }}</div>

                <div class="blocks">
                  <h4 class="blocks-title">Bloques</h4>

                  <ol class="block-list">
                    <li class="block-item" *ngFor="let b of blocksOf(w); index as i">
                      <div class="block-head">
                        <strong class="b-type">{{ (b?.type || '').toUpperCase() }}</strong>

                        <!-- AMRAP / EMOM duración -->
                        <span class="dot" *ngIf="b?.type==='amrap' || b?.type==='emom'">•</span>
                        <span class="b-meta" *ngIf="(b?.type==='amrap' || b?.type==='emom') && b['minutes']">
                          Duración: {{ b['minutes'] }} min
                        </span>

                        <!-- Cap para for_time / chipper / benchmark -->
                        <span class="dot" *ngIf="(b?.type==='for_time' || b?.type==='chipper' || b?.type==='benchmark') && b['capSeconds']">•</span>
                        <span class="b-meta" *ngIf="(b?.type==='for_time' || b?.type==='chipper' || b?.type==='benchmark') && b['capSeconds']">
                          Cap: {{ b['capSeconds'] }} s
                        </span>

                        <!-- Intervalos -->
                        <span class="dot" *ngIf="b?.type==='interval' && (b['rounds'] || (b['workSeconds'] && b['restSeconds']))">•</span>
                        <span class="b-meta" *ngIf="b?.type==='interval' && b['rounds']">
                          Rondas: {{ b['rounds'] }}
                        </span>
                        <span class="b-meta" *ngIf="b?.type==='interval' && b['workSeconds'] && b['restSeconds']">
                          Trabajo/Descanso: {{ b['workSeconds'] }}s / {{ b['restSeconds'] }}s
                        </span>

                        <!-- For load -->
                        <span class="dot" *ngIf="b?.type==='for_load' && (b['liftType'] || b['attempts'])">•</span>
                        <span class="b-meta" *ngIf="b?.type==='for_load' && b['liftType']">Levantamiento: {{ b['liftType'] }}</span>
                        <span class="b-meta" *ngIf="b?.type==='for_load' && b['attempts']">Intentos: {{ b['attempts'] }}</span>
                      </div>

                      <!-- Movimientos comunes -->
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

                      <!-- EMOM por minuto -->
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

              <!-- Footer / Acciones -->
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
                    <span class="time"
                          [class.pulse]="heat.status==='running'">
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
    /* ===== Shell ===== */
    .layout-container { height: 100dvh; background: #fff; }
    .side { width: 280px; border-right: 1px solid #eee; display:flex; flex-direction:column; }
    .side-header { display:flex; align-items:center; gap:10px; padding:16px 14px; }
    .brand { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color:#fff; font-weight:800; background:#FC5500; }
    .brand-txt span { color:#6b7280; font-size:.85rem; }
    .side-footer { margin-top:auto; padding:12px 14px; border-top:1px solid #eee; }
    .user { display:flex; gap:10px; align-items:center; color:#1d1d1f; }
    .user .meta .name { font-weight:600; }
    .user .meta .role { font-size:.85rem; color:#6b7280; }
    .subheader { padding-inline: 16px; font-weight: 700; color:#374151; }

    .app-toolbar { position: sticky; top: 0; z-index: 3; color:#fff; }
    .toolbar-title { display:flex; align-items:center; gap:10px; }
    .logo { background:#fff; color:#FC5500; border-radius:8px; padding:4px 8px; font-weight:800; }
    .title { font-weight:700; }
    .spacer { flex:1; }
    .only-handset { display:none; }
    .hide-handset { display:flex; gap:4px; }

    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding: 16px; display:grid; gap:16px; width:100%; max-width: 1400px; margin-inline:auto; }
    .page-title { margin:0; font-size: clamp(1.2rem, 2.6vw, 1.6rem); font-weight:900; }

    /* ===== Cards WOD ===== */
    .wods-grid {
      display:grid;
      grid-template-columns: minmax(0,1fr);
      gap: 16px;
      width:100%;
    }
    @media (min-width: 720px) {
      .wods-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    @media (min-width: 1200px) {
      .wods-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
    }

    .wod-card {
      border:1px solid #eee;
      border-radius:16px;
      overflow:hidden;
      background:#fff;
    }
    .avatar {
      background:#FC5500; color:#fff; border-radius:8px;
      display:grid; place-items:center; font-weight:800;
    }
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

    .wod-actions {
      display:flex; align-items:center; gap:10px; padding: 8px 16px 16px;
    }

    /* ===== Mobile-first ===== */
    @media (max-width: 959px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }
      .side { width: 86vw; }
    }

    /* Anti overflow */
    :host, .layout-container, .content, .main { max-width:100%; }
    .mat-sidenav-content { overflow-x: clip; }
    *,*::before,*::after { box-sizing: border-box; }

    /* Chip de estado */
    .chip.state {
      font-weight: 800;
      border-radius: 999px;
      padding: 2px 10px;
      margin-left: 6px;
    }
    .chip.st-scheduled { background: #e5e7eb; color:#374151; } /* gris */
    .chip.st-running   { background: rgba(252,85,0,.12); color:#FC5500; } /* naranja */
    .chip.st-finished  { background: #10b9811a; color:#059669; } /* verde suave */

    /* Footer responsive */
.wod-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 12px 16px 16px;
}

/* Botones: mismos paddings y centrado */
.wod-actions .btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 800;
  border-radius: 12px;
  text-align: center;
  min-height: 44px;
}

/* Verde (Iniciar) y Rojo (Finalizar) – sin tocar tu tema global */
.btn-start {
  background: #10b981;               /* verde */
  color: #fff;
  box-shadow: 0 4px 10px rgba(16,185,129,.25);
}
.btn-start:hover { background: #0ea371; }
.btn-start:disabled { background: #a7f3d0; color: #fff; }

.btn-finish {
  background: #ef4444;               /* rojo */
  color: #fff;
  box-shadow: 0 4px 10px rgba(239,68,68,.25);
}
.btn-finish:hover { background: #dc2626; }
.btn-finish:disabled { background: #fecaca; color: #fff; }

/* Leaderboard/Judge estilos suaves para contraste con CTA principales */
.action-leaderboard {
  border-width: 2px;
  border-radius: 12px;
  font-weight: 800;
}
.action-judge {
  background: rgba(252,85,0,.08);
  color: #FC5500;
  border-radius: 12px;
}

/* Layout en pantallas medianas/grandes: acciones en una fila */
@media (min-width: 720px) {
  .wod-actions {
    grid-template-columns: repeat(4, minmax(0,1fr));
  }
  /* Si no eres admin, igual se acomodan 2-3 columnas según existan */
  .wod-actions .btn,
  .wod-actions .action-leaderboard,
  .wod-actions .action-judge {
    width: 100%;
  }
}

/* Asegura que nunca haya overflow horizontal */
.mat-card-actions { overflow-x: clip; }

/* Timer del heat (ligado al branding) */
.heat-timer {
  display:flex; align-items:center; gap:10px;
  margin: 8px 16px 0;
}
.heat-timer .time {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  font-size: clamp(20px, 4.2vw, 28px);
  color:#FC5500;
  background: rgba(252,85,0,0.06);
  border-radius: 12px;
  padding: 6px 10px;
}
.heat-timer .time.pulse { animation: pulse 1.6s ease-in-out infinite; }

.badge {
  padding: 4px 10px; border-radius: 999px; font-weight: 800; color:#fff;
  font-size: .82rem; letter-spacing: .3px;
}
.badge-running  { background: #FC5500; }
.badge-finished { background: #10b981; }

/* ya tienes estos, aquí por claridad: */
.btn-start  { background:#10b981; color:#fff; box-shadow:0 4px 10px rgba(16,185,129,.25); }
.btn-finish { background:#ef4444; color:#fff; box-shadow:0 4px 10px rgba(239,68,68,.25); }

/* Reutiliza tu grid responsive del footer que ya hicimos */


  `],
})
export class HomeComponent {
  auth = inject(AuthService);
  private snack   = inject(MatSnackBar);
  private teamSvc = inject(TeamService);
  private scoreSvc = inject(ScoreService);

  private _timer?: any;
  nowTick = signal(Date.now());

  constructor(/* ...lo tuyo... */) {
    // ...lo que ya tienes...
    this._timer = setInterval(() => this.nowTick.set(Date.now()), 100);
  }

  ngOnDestroy() {
    clearInterval(this._timer);
  }
  private heatCache = new Map<string, Observable<{status:'scheduled'|'running'|'finished', startedAt?:number|null, finalTimeMs?:number|null}>>();

  heatOf(wodId: string) {
    if (!this.heatCache.has(wodId)) {
      const obs = this.scoreSvc.listForWod$(wodId).pipe(
        // siempre emite algo para que el template no parpadee
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
            // tiempo representativo del heat: el mayor finalTimeMs (cuando se pulsó finish)
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

  fmtClock(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
  }
  // ✅ helper para evitar (w as any) en la microsintaxis del *ngFor
  blocksOf(w: Wod): any[] {
    return (w as any)?.blocks ?? [];
  }

  // ✅ observable para el botón "Juzgar este WOD"
  isAdminOrJudge$ = this.auth.appUser$.pipe(
    map(u => !!u && (u.role === 'admin' || u.role === 'judge')),
    shareReplay(1)
  );

  trackById = (_: number, w: Wod) => (w as any).id;
  private bpo = inject(BreakpointObserver);
  private wodSvc = inject(WodService);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  // WODs para el dashboard
  wods$: Observable<Wod[]> = this.wodSvc.listAll$();

  // Si quieres limitar por categoría, filtra aquí:
  // wods$ = this.wodSvc.listAll$().pipe(map(ws => ws.filter(w => w.category === 'RX')));

  logout() { this.auth.logout(); }

  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }

  // al inicio del archivo ya tienes imports de map/shareReplay
  isAdmin$ = this.auth.appUser$.pipe(
    map(u => !!u && u.role === 'admin'),
    shareReplay(1)
  );

  private teamsCache = new Map<Category, Team[]>();

  loadTeamsFor(cat: Category) {
    if (this.teamsCache.has(cat)) return;
    this.teamSvc.listByCategory$(cat).subscribe(ts => this.teamsCache.set(cat, ts));
  }
  teamsFor(cat: Category): Team[] {
    return this.teamsCache.get(cat) ?? [];
  }

  async startAll(wodId: string, category: 'RX'|'Intermedio') {
    const scores = await firstValueFrom(this.scoreSvc.listForWod$(wodId).pipe(take(1)));
    const targets = scores.filter(s => s.category === category);

    // Un único "startedAt" para todos
    const masterStartedAt = Date.now();

    for (const s of targets) {
      await this.scoreSvc.start(s.id, masterStartedAt); // nuevo parámetro
    }
  }

  async finishAll(wodId: string, category: 'RX'|'Intermedio') {
    const scores = await firstValueFrom(this.scoreSvc.listForWod$(wodId).pipe(take(1)));
    const targets = scores.filter(s => s.category === category);

    // Un único "finishNow" para todos
    const masterFinishedAt = Date.now();

    for (const s of targets) {
      // Si es "for time" y tiene startedAt, todos quedan con el mismo elapsed
      const elapsed = (s.startedAt != null) ? (masterFinishedAt - s.startedAt) : null;
      await this.scoreSvc.finish(s.id, elapsed);
    }
  }


  // Lee status de forma segura aunque no esté tipado en Wod
  statusOf(w: Wod): 'scheduled' | 'running' | 'finished' {
    const s = (w as any)?.status;
    return s === 'running' || s === 'finished' ? s : 'scheduled';
  }

  statusClass(w: Wod) {
    const s = this.statusOf(w);
    return {
      'st-scheduled': s === 'scheduled',
      'st-running': s === 'running',
      'st-finished': s === 'finished',
    };
  }

  statusLabel(w: Wod) {
    const s = this.statusOf(w);
    return s === 'running' ? 'En curso' : s === 'finished' ? 'Finalizado' : 'Programado';
  }


}
