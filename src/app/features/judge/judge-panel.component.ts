// src/app/features/judge/judge-panel.component.ts
import { Component, inject, signal, OnDestroy, TemplateRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay, BehaviorSubject, Observable, Subject, Subscription, takeUntil } from 'rxjs';
import { ChangeDetectorRef, NgZone } from '@angular/core';

import { Team, Category } from '../../../core/models/team';
import { Wod } from '../../../core/models/wod';
import { ScoreService } from '../../../core/services/score.service';
import { TeamService } from '../../../core/services/team.service';
import { WodService } from '../../../core/services/wod.service';

type ScoreStatus = 'not_started' | 'running' | 'paused' | 'finished' | 'dnf';

@Component({
  standalone: true,
  selector: 'app-judge-panel',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatIconModule, MatToolbarModule, MatSidenavModule, MatDividerModule, MatListModule,
    RouterLink, RouterLinkActive,
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <!-- Lateral -->
      <mat-sidenav #drawer class="side"
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="!(isHandset$ | async)">
        <div class="side-header">
          <div class="brand">CF</div>
          <div class="brand-txt">
            <strong>CrossFit</strong>
            <span>Competition</span>
          </div>
        </div>

        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a mat-list-item routerLink="/leaderboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
            <mat-icon matListItemIcon>leaderboard</mat-icon>
            <span matListItemTitle>Resultados</span>
          </a>
          <a mat-list-item routerLink="/my-team" routerLinkActive="active" (click)="closeOnMobile(drawer)">
            <mat-icon matListItemIcon>group</mat-icon>
            <span matListItemTitle>Mi equipo</span>
          </a>
          <a mat-list-item routerLink="/judge" routerLinkActive="active" (click)="closeOnMobile(drawer)">
            <mat-icon matListItemIcon>gavel</mat-icon>
            <span matListItemTitle>Panel Juez</span>
          </a>
          <mat-divider></mat-divider>
          <button mat-list-item (click)="logout(); closeOnMobile(drawer)">
            <mat-icon matListItemIcon>logout</mat-icon>
            <span matListItemTitle>Salir</span>
          </button>
        </mat-nav-list>
      </mat-sidenav>

      <!-- Contenido -->
      <mat-sidenav-content class="content">
        <mat-toolbar class="app-toolbar" color="primary">
          <button mat-icon-button class="only-handset" (click)="drawer.toggle()" aria-label="Abrir menú">
            <mat-icon>menu</mat-icon>
          </button>

          <div class="toolbar-title">
            <span class="logo">CF</span>
            <span class="title">Panel de Juez</span>
          </div>
          <span class="spacer"></span>

          <div class="status-badges hide-handset" *ngIf="scoreReady()">
            <span class="badge"
                  [class.badge-running]="status()==='running'"
                  [class.badge-paused]="status()==='paused'"
                  [class.badge-finished]="status()==='finished'"
                  [class.badge-dnf]="status()==='dnf'">
              {{ status() | uppercase }}
            </span>
          </div>
        </mat-toolbar>

        <main class="main">
          <mat-card class="card slide-in">
            <!-- Bloque de configuración inicial (FORM + PREPARAR) -->
            <ng-container *ngIf="!scoreReady(); else activeBlock">
              <form [formGroup]="form" class="grid">
                <mat-form-field appearance="outline">
                  <mat-label>WOD</mat-label>
                  <mat-select formControlName="wodId" (selectionChange)="onSelectWod($event.value)">
                    <mat-option *ngFor="let w of wods(); trackBy: trackById" [value]="w.id">
                      {{ w.name }} — {{ w.category }} ({{ w.scoringMode }})
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>WOD Nombre</mat-label>
                  <input matInput formControlName="wodName" readonly />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Scoring</mat-label>
                  <input matInput formControlName="scoringMode" readonly />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Categoría</mat-label>
                  <mat-select formControlName="category" (selectionChange)="onCategoryChange($event.value)">
                    <mat-option value="RX">RX</mat-option>
                    <mat-option value="Intermedio">Intermedio</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="col-2">
                  <mat-label>Equipo</mat-label>
                  <mat-select formControlName="teamId" (selectionChange)="onSelectTeam($event.value)">
                    <mat-option *ngFor="let t of teams(); trackBy: trackById" [value]="t.id">
                      {{ t.name }} — {{ t.category }} ({{ t.membersIds.length }} miembros)
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Equipo ID</mat-label>
                  <input matInput formControlName="teamId" readonly />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Equipo Nombre</mat-label>
                  <input matInput formControlName="teamName" readonly />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Cap (segundos)</mat-label>
                  <input type="number" matInput formControlName="capSeconds" />
                </mat-form-field>
              </form>

              <div class="row controls-top">
                <button mat-raised-button color="primary" (click)="prepareScore()"
                  [disabled]="!form.valid || status() === 'running' || scoreReady()">
                  <mat-icon class="btn-ic">check_circle</mat-icon> Preparar score
                </button>
              </div>
            </ng-container>

            <!-- Bloque activo (solo info + controles) -->
            <ng-template #activeBlock>
              <!-- Encabezado compacto con WOD y Equipo -->
              <div class="active-head">
                <div class="chip">
                  <mat-icon>fitness_center</mat-icon>
                  <span class="chip-txt">{{ form.getRawValue().wodName || 'WOD' }}</span>
                </div>
                <div class="chip">
                  <mat-icon>groups</mat-icon>
                  <span class="chip-txt">{{ form.getRawValue().teamName || 'Equipo' }}</span>
                </div>
                <div class="chip muted">
                  <mat-icon>category</mat-icon>
                  <span class="chip-txt">{{ form.getRawValue().category }}</span>
                </div>
              </div>

              <!-- CONTROLES -->
              <div class="controls">
                <!-- TIEMPO -->
                <section class="timer card-soft" *ngIf="scoringModeVal === 'time'">
                  <div class="time big" [class.pulse]="status()==='running'">
                    {{ displayTime() | async }}
                  </div>

                  <div class="timer-actions center">
                    <button class="btn-big" mat-raised-button color="primary"
                      (click)="startTimer()" [disabled]="!canStart()">
                      <mat-icon class="btn-ic">play_arrow</mat-icon> Start
                    </button>

                    <button class="btn-big" mat-raised-button color="warn"
                      (click)="stopTimer()" [disabled]="!canStop()">
                      <mat-icon class="btn-ic">pause</mat-icon> Stop
                    </button>

                    <button class="btn-big" mat-stroked-button
                      (click)="finish()" [disabled]="!canFinish()">
                      <mat-icon class="btn-ic">flag</mat-icon> Finalizar
                    </button>

                    <button class="btn-big" mat-stroked-button color="warn"
                      (click)="markDNF()" [disabled]="!canDNF()">
                      <mat-icon class="btn-ic">block</mat-icon> DNF
                    </button>
                  </div>
                </section>

                <!-- REPETICIONES (en time y en reps) -->
                <section class="reps card-soft" *ngIf="scoringModeVal === 'reps' || scoringModeVal === 'time'">
                  <div class="rep-counters center">
                    Reps: <strong>{{ reps() }}</strong> &nbsp;|&nbsp; No-Reps: <strong>{{ noReps() }}</strong>
                  </div>

                  <div class="rep-actions center">
                    <button class="btn-xl btn-rep" mat-raised-button
                      (click)="incRep()" [disabled]="isLockedForInputs() || loading">
                      <mat-icon class="btn-ic">add</mat-icon> rep
                    </button>
                    <button class="btn-xl btn-norep" mat-raised-button
                      (click)="incNoRep()" [disabled]="isLockedForInputs() || loading">
                      <mat-icon class="btn-ic">thumb_down</mat-icon> no-rep
                    </button>
                  </div>
                </section>

                <!-- CARGA -->
                <section class="load card-soft" *ngIf="scoringModeVal === 'load'">
                  <div class="load-head center">
                    Mejor carga: <strong>{{ maxLoad() ?? 0 }}</strong> kg
                  </div>

                  <div class="row center">
                    <mat-form-field appearance="outline" class="load-input">
                      <mat-label>Carga (kg)</mat-label>
                      <input matInput type="number" [(ngModel)]="currentLoad" [ngModelOptions]="{standalone: true}" />
                    </mat-form-field>
                    <button mat-stroked-button (click)="saveAttempt()" [disabled]="isLockedForInputs()">
                      <mat-icon class="btn-ic">save</mat-icon> Guardar intento
                    </button>
                  </div>

                  <div class="row center">
                    <button mat-raised-button color="accent" class="btn-big" (click)="finish()" [disabled]="!canFinish()">
                      <mat-icon class="btn-ic">flag</mat-icon> Finalizar
                    </button>
                    <button mat-stroked-button color="warn" class="btn-big" (click)="markDNF()" [disabled]="!canDNF()">
                      <mat-icon class="btn-ic">block</mat-icon> DNF
                    </button>
                  </div>

                  <div *ngIf="maxLoad() != null" class="row muted center">Máximo actual: {{ maxLoad() }} kg</div>
                </section>
              </div>
            </ng-template>
          </mat-card>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    /* ===== Layout coherente con el resto ===== */
    .layout-container { height: 100dvh; background:#fff; }
    .side { width: 270px; border-right:1px solid #f1f1f1; display:flex; flex-direction:column; background:#fff; }
    .side-header { display:flex; align-items:center; gap:10px; padding:16px 14px; }
    .brand { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color:#fff; font-weight:800; background:#FC5500; }
    .brand-txt span { color:#9e9e9e; font-size:.85rem; }
    .active { background: rgba(252,85,0,0.08); }

    .app-toolbar { position: sticky; top: 0; z-index: 3; color:#fff; }
    .toolbar-title { display:flex; align-items:center; gap:10px; }
    .logo { background:#fff; color:#FC5500; border-radius:8px; padding:4px 8px; font-weight:800; }
    .title { font-weight:700; color:#fff; }
    .spacer { flex:1; }
    .only-handset { display:none; }
    .hide-handset { display:flex; gap:8px; }

    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding:16px; display:grid; gap:16px; }
    .card { background:#fff; border:1px solid #eee; border-radius:16px; padding:16px; max-width: 1100px; margin-inline:auto; }
    .card-soft { border:1px solid #f0f0f0; border-radius:14px; padding:12px; }

    /* Grid responsive para el formulario */
    .grid { display:grid; grid-template-columns: 1fr; gap:12px; }
    .col-2 { grid-column: span 1; }

    .controls-top { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:12px; }
    .btn-ic { margin-right:6px; }

    /* Bloque activo */
    .active-head {
      display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:center;
      margin-bottom: 10px;
    }
    .chip {
      display:inline-flex; align-items:center; gap:6px;
      background: rgba(252,85,0,0.06);
      color:#FC5500; border-radius: 999px; padding:6px 12px; font-weight:600;
    }
    .chip.muted { color:#6b7280; background:#fafafa; }
    .chip mat-icon { font-size:18px; height:18px; width:18px; line-height:18px; }

    .controls { display:grid; gap:16px; margin-top:12px; }
    .center { justify-content:center; text-align:center; }

    .timer .time {
      font-weight:800; font-variant-numeric: tabular-nums;
      font-size: clamp(36px, 7vw, 64px);
      letter-spacing: .5px; text-align:center; color:#FC5500;
      padding: 8px 12px; border-radius: 12px; background: rgba(252,85,0,0.06);
      transition: transform .2s ease, box-shadow .2s ease;
    }
    .timer .time.big { padding: 12px 16px; }
    .timer .time.pulse { animation: pulse 1.6s ease-in-out infinite; }
    .timer-actions { display:flex; gap:12px; flex-wrap:wrap; }

    /* Botones grandes */
    .btn-big { padding: 12px 18px; font-size: 1.05rem; font-weight:700; border-radius:12px; }
    .btn-xl  { padding: 14px 24px; font-size: 1.1rem;  font-weight:800; border-radius:14px; min-width: 140px; }

    /* Rep verde, No-rep rojo (accesible) */
    .btn-rep   { background: #43a047; color:#fff; }   /* green 600 */
    .btn-rep:hover { filter: brightness(1.05); }
    .btn-norep { background: #e53935; color:#fff; }   /* red 600 */
    .btn-norep:hover { filter: brightness(1.05); }

    .rep-counters { font-weight:600; }
    .rep-actions  { display:flex; gap:14px; flex-wrap:wrap; align-items:center; justify-content:center; }

    .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .load-input { width: 160px; }
    .muted { color:#9e9e9e; font-size:.95rem; }

    /* Badges estado */
    .badge { padding:4px 10px; border-radius:999px; font-weight:700; letter-spacing:.3px; color:#fff; background:#c7c7c7; }
    .badge-running { background:#FC5500; } .badge-paused { background:#9e9e9e; }
    .badge-finished { background:#4caf50; } .badge-dnf { background:#f44336; }

    /* Animaciones */
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(252,85,0,.35); transform: scale(1); }
      70% { box-shadow: 0 0 0 14px rgba(252,85,0,0); transform: scale(1.02); }
      100% { box-shadow: 0 0 0 0 rgba(252,85,0,0); transform: scale(1); }
    }
    .slide-in { animation: slideIn .28s ease-out both; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* ===== Responsive ===== */
    @media (max-width: 599px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }
      .side { width: 88vw; }
      .card { padding:12px; border-radius:14px; }

      .grid { grid-template-columns: 1fr; }
      .col-2 { grid-column: span 1; }

      .timer-actions { justify-content:center; }
      .btn-big { width: 100%; max-width: 280px; }
      .btn-xl  { width: calc(50% - 8px); min-width: unset; }
    }

    @media (min-width: 600px) and (max-width: 959px) {
      .grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .col-2 { grid-column: span 2; }
    }

    @media (min-width: 960px) {
      .grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
      .col-2 { grid-column: span 2; }
    }

    /* === PARCHE: full-width en móviles para el formulario === */
    .grid > mat-form-field,
    .grid > .col-2,
    .grid mat-form-field,
    mat-form-field {
      width: 100%;
      min-width: 0; /* anula el min-width interno de Material */
    }

    /* Evita que el contenedor limite el ancho en móviles */
    .card {
      width: 100%;
      max-width: none;
      margin-inline: 0;
    }

    /* Espaciado y densidad mobile-first */
    @media (max-width: 599px) {
      .main { padding: 12px; }
      .card { padding: 12px; border-radius: 14px; }
      .grid { grid-template-columns: 1fr; gap: 10px; }

      /* Campos más compactos en pantallas pequeñas */
      .mat-mdc-form-field-infix { padding-top: 10px; padding-bottom: 10px; }
    }

    /* En pantallas medianas/grandes mantenemos el layout limpio, centrado */
    @media (min-width: 600px) and (max-width: 1199px) {
      .card { max-width: 920px; margin-inline: auto; }
    }
    @media (min-width: 1200px) {
      .card { max-width: 1100px; margin-inline: auto; }
    }

  `]
})
export class JudgePanelComponent implements OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private wodsSvc = inject(WodService);
  private scoreSvc = inject(ScoreService);
  private teamSvc = inject(TeamService);
  private bpo = inject(BreakpointObserver);

  private scoreSub?: Subscription;
  private destroy$ = new Subject<void>();
  

  wods = signal<Wod[]>([]);
  teams = signal<Team[]>([]);
  selectedWod: Wod | null = null;

  reps = signal(0);
  noReps = signal(0);
  currentLoad = 0;
  maxLoad = signal<number | null>(null);
  startedAt = signal<number | null>(null);
  finalTimeMs = signal<number | null>(null);
  status = signal<ScoreStatus>('not_started');
  private timeDisplay$ = new BehaviorSubject<string>('00:00.00');
  tick = signal(0);
  private ticker: ReturnType<typeof setInterval> | null = null;
  private pausedOverride = false;
  private finishing = false;

  scoreId = signal<string | null>(null);
  scoreReady = signal(false);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  form = this.fb.group({
    wodId: ['', Validators.required],
    wodName: [{ value: '', disabled: true }],
    scoringMode: [{ value: 'time' as 'time'|'reps'|'load', disabled: true }, Validators.required],
    category: ['RX' as Category, Validators.required],
    teamId: ['', Validators.required],
    teamName: [{ value: '', disabled: true }],
    capSeconds: [null as number | null],
  });

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    this.wodsSvc.listAll$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(ws => this.wods.set(ws));

    this.form.get('category')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((cat) => this.onCategoryChange((cat || 'RX') as Category));

    this.onCategoryChange(this.form.getRawValue().category || 'RX');
  }

  ngAfterViewInit(): void {}

  // ======= Equipos =======
  onCategoryChange(cat: Category) {
    this.teamSvc.listByCategory$(cat)
      .pipe(takeUntil(this.destroy$))
      .subscribe(ts => this.teams.set(ts));
    this.form.patchValue({ teamId: '', teamName: '' });
  }

  get scoringModeVal() { return this.form.getRawValue().scoringMode; }
  get capSecondsVal() { return this.form.getRawValue().capSeconds; }

  onSelectTeam(teamId: string) {
    const team = this.teams().find(t => t.id === teamId);
    if (!team) return;
    this.form.patchValue({ teamId: team.id, teamName: team.name });
  }

  // ======= WOD =======
  onSelectWod(wodId: string) {
    const wod = this.wods().find(w => w.id === wodId) || null;
    this.selectedWod = wod;
    this.form.patchValue({
      wodName: wod?.name || '',
      scoringMode: (wod?.scoringMode as any) || 'time',
      capSeconds: this.deriveCapSecondsFromBlocks(wod)
    }, { emitEvent: false });
  }

  trackById = (_: number, item: { id: string }) => item.id;

  deriveCapSecondsFromBlocks(wod: Wod | null): number | null {
    if (!wod) return null;
    const blocks = (wod as any).blocks ?? [];
    const capBlock = blocks.find((b: any) => b?.capSeconds != null);
    if (capBlock?.capSeconds != null) return Number(capBlock.capSeconds);
    const amrap = blocks.find((b: any) => b?.type === 'amrap');
    if (amrap?.minutes) return Number(amrap.minutes) * 60;
    const emom  = blocks.find((b: any) => b?.type === 'emom');
    if (emom?.minutes)  return Number(emom.minutes) * 60;
    return null;
  }

  // ======= Timer helpers =======
  private startTicker() {
    this.stopTicker();
    this.ticker = setInterval(() => {
      this.ngZone.run(() => {
        this.tick.update(v => v + 1);

        if (this.status() === 'running' && this.startedAt() && !this.pausedOverride) {
          const elapsed = Date.now() - (this.startedAt() as number);
          const timeStr = this.msToClock(elapsed);
          this.timeDisplay$.next(timeStr);

          const cap = this.capSecondsVal;
          if (!this.finishing && cap && cap > 0 && elapsed >= cap * 1000) {
            this.finishing = true;
            this.finish().finally(() => { this.finishing = false; });
          }
        } else {
          this.timeDisplay$.next(this.msToClock(this.finalTimeMs() ?? 0));
        }
      });
    }, 100);
  }
  private stopTicker() {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
  }

  displayTime(): Observable<string> { return this.timeDisplay$.asObservable(); }

  msToClock(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
  }

  // ======= Flujo =======
  async prepareScore() {
    this.form.markAllAsTouched();
    if (!this.form.valid) { alert('Selecciona WOD y equipo'); return; }
    const v = this.form.getRawValue();
    const id = await this.scoreSvc.ensureScoreDoc({
      wodId: v.wodId!, wodName: v.wodName || '',
      scoringMode: (this.selectedWod?.scoringMode as any) || v.scoringMode!,
      category: v.category!, teamId: v.teamId!, teamName: v.teamName!,
      capSeconds: v.capSeconds ?? null,
    });
    this.scoreId.set(id);
    this.scoreReady.set(true);           // 🔸 dispara el UI sólo-controles
    this.currentLoad = 0;
    this.bindScore(id);
  }

  loading = false;

  async incRep() {
    if (this.loading) return;
    this.loading = true;
    try {
      if (!this.scoreId()) { await this.prepareScore(); if (!this.scoreId()) return; }
      await this.scoreSvc.incrementReps(this.scoreId()!);
    } finally { this.loading = false; }
  }

  async incNoRep() {
    if (this.loading) return;
    this.loading = true;
    try {
      if (!this.scoreId()) { await this.prepareScore(); if (!this.scoreId()) return; }
      await this.scoreSvc.incrementNoReps(this.scoreId()!);
    } finally { this.loading = false; }
  }

  async saveAttempt() {
    if (!this.scoreId()) { await this.prepareScore(); }
    const load = Number(this.currentLoad) || 0;
    await this.scoreSvc.addLoadAttempt(this.scoreId()!, load, true);
  }

  async startTimer() {
    if (!this.scoreId()) { await this.prepareScore(); }
    if (this.status() === 'paused' && this.finalTimeMs()) {
      const resumeStart = Date.now() - (this.finalTimeMs() as number);
      this.startedAt.set(resumeStart);
      this.finalTimeMs.set(null);
    }
    this.pausedOverride = false;
    this.status.set('running');
    if (!this.startedAt()) this.startedAt.set(Date.now());
    this.startTicker();
    await this.scoreSvc.start(this.scoreId()!);
  }

  async stopTimer() {
    if (!this.scoreId()) return;
    if (this.status() !== 'running') return;

    if (this.startedAt()) {
      const elapsed = Date.now() - (this.startedAt() as number);
      this.finalTimeMs.set(elapsed);
    }
    this.status.set('paused');
    this.pausedOverride = true;
    this.stopTicker();
    await this.scoreSvc.stop(this.scoreId()!);
  }

  async finish() {
    if (!this.scoreId()) return;

    if (this.status() === 'running' && this.startedAt() && !this.finalTimeMs()) {
      const elapsed = Date.now() - (this.startedAt() as number);
      await this.scoreSvc.finish(this.scoreId()!, elapsed);
    } else {
      await this.scoreSvc.finish(this.scoreId()!);
    }

    this.pausedOverride = false;
    this.stopTicker();
  }

  async markDNF() {
    if (!this.scoreId()) return;
    await this.scoreSvc.markDNF(this.scoreId()!);
    this.pausedOverride = false;
    this.stopTicker();
  }

  private bindScore(id: string) {
    this.scoreSub?.unsubscribe();
    this.scoreSub = this.scoreSvc.watch$(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => {
        if (!s) return;
        this.reps.set(s.reps || 0);
        this.noReps.set(s.noReps || 0);
        this.maxLoad.set(s.maxLoadKg ?? null);

        const nextStatus = (s.status as ScoreStatus) || 'not_started';

        if (this.pausedOverride && nextStatus === 'running') {
          // mantener congelado hasta que status cambie
        } else {
          this.status.set(nextStatus);

          if (nextStatus === 'running' && s.startedAt) {
            this.startedAt.set(s.startedAt as any);
            this.finalTimeMs.set(null);
            this.startTicker();
          } else {
            this.startedAt.set((s.startedAt as any) ?? null);
            this.finalTimeMs.set(
              s.finalTimeMs ?? (nextStatus === 'paused' && this.finalTimeMs() ? this.finalTimeMs() : null)
            );
            this.stopTicker();
          }

          if (this.pausedOverride && nextStatus !== 'running') {
            this.pausedOverride = false;
          }
        }

        if (s.capSeconds != null && s.capSeconds !== this.form.getRawValue().capSeconds) {
          this.form.patchValue({ capSeconds: s.capSeconds }, { emitEvent: false });
        }
        if (s.scoringMode && s.scoringMode !== this.form.getRawValue().scoringMode) {
          this.form.patchValue({ scoringMode: s.scoringMode as any }, { emitEvent: false });
        }
      });
  }

  // ======= Habilitaciones UI =======
  isLockedForInputs(): boolean {
    return !this.scoreReady() || !this.scoreId() || this.status() === 'finished' || this.status() === 'dnf';
  }
  canStart(): boolean {
    return this.scoreReady() && !!this.scoreId()
      && this.status() !== 'running'
      && this.status() !== 'finished'
      && this.status() !== 'dnf';
  }
  canStop(): boolean {
    return this.scoreReady() && !!this.scoreId() && this.status() === 'running';
  }
  canFinish(): boolean {
    return this.scoreReady() && !!this.scoreId() && (this.status() === 'running' || this.status() === 'paused');
  }
  canDNF(): boolean {
    return this.scoreReady() && !!this.scoreId() && (this.status() === 'running' || this.status() === 'paused');
  }

  ngOnDestroy() {
    this.scoreSub?.unsubscribe();
    this.stopTicker();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ======= Helpers layout =======
  logout() {}
  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }
}
