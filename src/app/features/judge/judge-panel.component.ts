// src/app/features/judge/judge-panel.component.ts
import { Component, inject, signal, OnDestroy, AfterViewInit } from '@angular/core';
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

/** ===== Tipos internos para renderizar y controlar segmentos ===== */
type SegmentKind = 'reps_sequence' | 'time_driven' | 'lift';
interface SegmentMovement {
  name: string;
  targetReps: number | null;   // null cuando no aplica (AMRAP/EMOM/etc)
  loadKg?: number | null;
  notes?: string;
}
interface CompiledSegment {
  kind: SegmentKind;
  label: string;                // título de UI
  movements: SegmentMovement[]; // lista de movimientos del segmento
  // Para time_driven (informativo)
  startAtSec?: number;
  endAtSec?: number;
}
interface CompiledWod {
  mode: 'time' | 'reps' | 'load';
  capSeconds: number | null;          // si existe, manda sobre todo
  totalDurationSeconds: number | null;
  segments: CompiledSegment[];        // secuencias por reps + time-driven (para mostrar)
  isTimeDriven: boolean;              // AMRAP/EMOM/INTERVAL/TABATA
  isLift: boolean;                    // FOR LOAD
}

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
            <!-- Bloque de configuración inicial -->
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

            <!-- Bloque activo (timer + ejercicios + controles) -->
            <ng-template #activeBlock>
              <!-- Encabezado compacto -->
              <div class="active-head">
                <div class="chip">
                  <mat-icon>fitness_center</mat-icon>
                  <span class="chip-txt">{{ form.getRawValue().wodName || 'WOD' }}</span>
                </div>
                <div class="chip">
                  <mat-icon>groups</mat-icon>
                  <span class="chip-txt">{{ form.getRawValue().teamName || 'Equipo' }}</span>
                </div>
                <div class="chip muted" *ngIf="compiled()?.capSeconds">
                  <mat-icon>timer</mat-icon>
                  <span class="chip-txt">Cap: {{ compiled()?.capSeconds!/60 | number:'1.0-0' }} min</span>
                </div>
                <div class="chip muted">
                  <mat-icon>category</mat-icon>
                  <span class="chip-txt">{{ form.getRawValue().category }}</span>
                </div>
              </div>

              <!-- Timer: SIEMPRE visible (lo inicia Admin) -->
              <section class="timer card-soft">
                <div class="time big" [class.pulse]="status()==='running'">
                  {{ displayTime() | async }}
                </div>
              </section>

              <!-- Panel de segmento/ejercicios -->
              <section class="card-soft" *ngIf="compiled() as cw">
                <!-- LIFT -->
                <ng-container *ngIf="cw.isLift; else nonLift">
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

                  <!-- Judge puede finalizar o marcar DNF -->
                  <div class="row center" style="margin-top:10px;">
                    <button class="btn-big" mat-raised-button color="accent" (click)="finish()" [disabled]="!canFinish()">
                      <mat-icon class="btn-ic">flag</mat-icon> Finalizar
                    </button>
                    <button class="btn-big" mat-stroked-button color="warn" (click)="markDNF()" [disabled]="!canDNF()">
                      <mat-icon class="btn-ic">block</mat-icon> DNF
                    </button>
                  </div>
                </ng-container>

                <!-- NO LIFT -->
                <ng-template #nonLift>
                  <!-- Secuencia por segmentos (FOR TIME / CHIPPER / BENCHMARK) -->
                  <ng-container *ngIf="!cw.isTimeDriven; else timeDrivenTpl">
                    <div class="center muted" *ngIf="cw.segments.length">
                      Segmento {{ currentSegmentIndex()+1 }} / {{ cw.segments.length }}
                    </div>

                    <div class="segment">
                      <div class="segment-title">
                        {{ currentSegment()?.label || 'Segmento' }}
                      </div>

                      <div class="movements" *ngIf="currentSegment()?.movements?.length; else noMovs">
                        <div class="mv" *ngFor="let mv of segmentMovements(); let i = index" [class.mv-done]="isMovementComplete(i)">
                          <div class="mv-info">
                            <strong>{{ mv.name }}</strong>
                            <span class="muted" *ngIf="mv.targetReps != null">
                              &nbsp;• {{ segmentRepsDone(i) }} / {{ mv.targetReps }}
                            </span>
                            <span class="muted" *ngIf="mv.targetReps == null">&nbsp;• Libre</span>
                          </div>

                          <div class="row mv-actions">
                            <button
                              mat-raised-button
                              class="btn-rep btn-fw"
                              (click)="incSegmentRep(i)"
                              [disabled]="isLockedForInputs() || isMovementComplete(i) || isCurrentSegmentComplete()"
                            >
                              <mat-icon class="btn-ic">add</mat-icon> + rep
                            </button>

                            <button
                              mat-raised-button
                              class="btn-norep btn-fw"
                              (click)="incNoRep()"
                              [disabled]="isLockedForInputs() || isCurrentSegmentComplete()"
                            >
                              <mat-icon class="btn-ic">thumb_down</mat-icon> no-rep
                            </button>
                          </div>
                        </div>
                      </div>

                      <ng-template #noMovs>
                        <div class="center muted">Sin movimientos en este segmento.</div>
                      </ng-template>
                    </div>

                    <div class="row center" style="margin-top:10px;">
                      <button class="btn-big" mat-stroked-button (click)="nextSegment()" [disabled]="!canGoNextSegment()">
                        <mat-icon class="btn-ic">navigate_next</mat-icon> Siguiente segmento
                      </button>
                      <button class="btn-big" mat-raised-button color="accent"
                        (click)="finish()" [disabled]="!canFinish()">
                        <mat-icon class="btn-ic">flag</mat-icon> Finalizar
                      </button>
                    </div>
                  </ng-container>

                  <!-- WODs dirigidos por tiempo (AMRAP / EMOM / INTERVAL / TABATA) -->
                  <ng-template #timeDrivenTpl>
                    <div class="center muted">
                      {{ timeDrivenLabel() }}
                    </div>

                    <!-- Lista de movimientos del bloque time-driven -->
                    <div class="movements card-soft" *ngIf="currentSegment()?.movements?.length">
                      <div class="mv" *ngFor="let mv of currentSegment()!.movements">
                        <div class="mv-info">
                          <strong>{{ mv.name }}</strong>
                          <span class="muted" *ngIf="mv.loadKg != null">&nbsp;• {{ mv.loadKg }} kg</span>
                          <span class="muted" *ngIf="mv.notes">&nbsp;• {{ mv.notes }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- En time-driven mantenemos botones globales de rep/no-rep -->
                    <section class="reps card-soft">
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

                    <div class="row center" style="margin-top:10px;">
                      <button class="btn-big" mat-raised-button color="accent"
                        (click)="finish()" [disabled]="!canFinish()">
                        <mat-icon class="btn-ic">flag</mat-icon> Finalizar
                      </button>
                    </div>
                  </ng-template>
                </ng-template>
              </section>
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

    .grid { display:grid; grid-template-columns: 1fr; gap:12px; }
    .col-2 { grid-column: span 1; }

    .controls-top { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:12px; }
    .btn-ic { margin-right:6px; }

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

    .btn-big { padding: 12px 18px; font-size: 1.05rem; font-weight:700; border-radius:12px; }
    .btn-xl  { padding: 14px 24px; font-size: 1.1rem;  font-weight:800; border-radius:14px; min-width: 140px; }

    .btn-rep   { background: #43a047; color:#fff; }
    .btn-rep:hover { filter: brightness(1.05); }
    .btn-norep { background: #e53935; color:#fff; }
    .btn-norep:hover { filter: brightness(1.05); }

    .rep-counters { font-weight:600; }
    .rep-actions  { display:flex; gap:14px; flex-wrap:wrap; align-items:center; justify-content:center; }

    .segment { display:grid; gap:10px; }
    .segment-title { font-weight:800; color:#333; }
    .movements { display:grid; gap:8px; }
    .mv { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border:1px solid #f0f0f0; border-radius:12px; }
    .mv-info { display:flex; align-items:center; gap:8px; }

    .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .load-input { width: 160px; }
    .muted { color:#9e9e9e; font-size:.95rem; }

    .badge { padding:4px 10px; border-radius:999px; font-weight:700; letter-spacing:.3px; color:#fff; background:#c7c7c7; }
    .badge-running { background:#FC5500; } .badge-paused { background:#9e9e9e; }
    .badge-finished { background:#4caf50; } .badge-dnf { background:#f44336; }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(252,85,0,.35); transform: scale(1); }
      70% { box-shadow: 0 0 0 14px rgba(252,85,0,0); transform: scale(1.02); }
      100% { box-shadow: 0 0 0 0 rgba(252,85,0,0); transform: scale(1); }
    }
    .slide-in { animation: slideIn .28s ease-out both; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 599px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }
      .side { width: 88vw; }
      .card { padding:12px; border-radius:14px; }

      .grid { grid-template-columns: 1fr; }
      .col-2 { grid-column: span 1; }

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

    .grid > mat-form-field, .grid > .col-2, .grid mat-form-field, mat-form-field { width: 100%; min-width: 0; }

    .card { width: 100%; max-width: none; margin-inline: 0; }

    @media (min-width: 600px) and (max-width: 1199px) {
      .card { max-width: 920px; margin-inline: auto; }
    }
    @media (min-width: 1200px) {
      .card { max-width: 1100px; margin-inline: auto; }
    }

    /* Contenedor de acciones de cada movimiento */
    .mv-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* Botón full-width */
    .btn-fw { width: 100%; }
    /* En pantallas medianas+, lado a lado */
    @media (min-width: 600px) {
      .mv-actions { flex-direction: row; }
      .mv-actions .btn-fw { flex: 1 1 0; }
    }
    .mv-done { opacity: .6; pointer-events: none; }
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

  // Totales globales (persisten con ScoreService)
  reps = signal(0);
  noReps = signal(0);
  currentLoad = 0;
  maxLoad = signal<number | null>(null);

  // Timer
  startedAt = signal<number | null>(null);
  finalTimeMs = signal<number | null>(null);
  status = signal<ScoreStatus>('not_started');
  private timeDisplay$ = new BehaviorSubject<string>('00:00.00');
  tick = signal(0);
  private ticker: ReturnType<typeof setInterval> | null = null;
  private pausedOverride = false;
  private finishing = false;

  // Compilación del WOD a segmentos
  private compiledWod = signal<CompiledWod | null>(null);
  compiled = this.compiledWod; // alias para template
  private segmentIndex = signal(0);
  currentSegmentIndex = this.segmentIndex;
  // progreso local por movimiento del segmento actual (solo secuencias por reps)
  private segmentProgress: number[] = [];

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

    const capSeconds = this.deriveCapSecondsFromBlocks(wod);
    const compiled = this.compileWod(wod, capSeconds);

    this.compiledWod.set(compiled);
    this.segmentIndex.set(0);
    this.segmentProgress = new Array(this.segmentMovements().length).fill(0);

    this.form.patchValue({
      wodName: wod?.name || '',
      scoringMode: (wod?.scoringMode as any) || 'time',
      capSeconds
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
    // Interval/Tabata duración total
    const interval = blocks.find((b: any) => b?.type === 'interval');
    if (interval?.workSeconds && interval?.restSeconds && interval?.rounds) {
      return interval.workSeconds * interval.rounds + interval.restSeconds * interval.rounds;
    }
    const tabata = blocks.find((b: any) => b?.type === 'tabata');
    if (tabata?.workSeconds && tabata?.restSeconds && tabata?.rounds) {
      return tabata.workSeconds * tabata.rounds + tabata.restSeconds * tabata.rounds;
    }
    return null;
  }

  /** Compila los bloques del WOD a un modelo común para UI */
  private compileWod(wod: Wod | null, capSeconds: number | null): CompiledWod {
    if (!wod) return { mode: 'time', capSeconds, totalDurationSeconds: capSeconds, segments: [], isTimeDriven: false, isLift: false };
    const blocks = ((wod as any).blocks ?? []) as any[];

    // Detectar tipos
    const hasAmrap = blocks.some(b => b.type === 'amrap');
    const hasEmom = blocks.some(b => b.type === 'emom');
    const hasInterval = blocks.some(b => b.type === 'interval');
    const hasTabata = blocks.some(b => b.type === 'tabata');
    const isTimeDriven = hasAmrap || hasEmom || hasInterval || hasTabata;

    const isLift = blocks.some(b => b.type === 'for_load');

    // total duration para dirigidos por tiempo
    let totalDurationSeconds: number | null = null;
    if (hasAmrap) {
      const b = blocks.find(x => x.type === 'amrap');
      totalDurationSeconds = (b?.minutes ?? 0) * 60;
    } else if (hasEmom) {
      const b = blocks.find(x => x.type === 'emom');
      totalDurationSeconds = (b?.minutes ?? 0) * 60;
    } else if (hasInterval) {
      const b = blocks.find(x => x.type === 'interval');
      totalDurationSeconds = (b?.workSeconds ?? 0) * (b?.rounds ?? 0) + (b?.restSeconds ?? 0) * (b?.rounds ?? 0);
    } else if (hasTabata) {
      const b = blocks.find(x => x.type === 'tabata');
      totalDurationSeconds = (b?.workSeconds ?? 0) * (b?.rounds ?? 0) + (b?.restSeconds ?? 0) * (b?.rounds ?? 0);
    }

    // Segments para secuencias por reps (for_time, chipper, benchmark)
    const segs: CompiledSegment[] = [];
    const seqBlocks = blocks.filter(b => ['for_time', 'chipper', 'benchmark'].includes(b.type));
    for (const b of seqBlocks) {
      const label = (b.type === 'for_time') ? 'FOR TIME'
                  : (b.type === 'chipper') ? 'CHIPPER'
                  : `BENCHMARK${b.name ? ' • ' + b.name : ''}`;
      const movements: SegmentMovement[] = (b.movements ?? []).map((m: any) => ({
        name: String(m.name ?? 'Movimiento'),
        targetReps: (m.reps != null ? Number(m.reps) : 0),
        loadKg: (m.loadKg != null ? Number(m.loadKg) : null),
        notes: m.notes ?? ''
      }));
      segs.push({ kind: 'reps_sequence', label, movements });
    }

    // Segments para time-driven (AMRAP / EMOM / INTERVAL / TABATA) — para mostrar ejercicios
    if (isTimeDriven) {
      const amrapBlock = blocks.find(b => b.type === 'amrap');
      if (amrapBlock) {
        const movements: SegmentMovement[] = (amrapBlock.movements ?? []).map((m: any) => ({
          name: String(m.name ?? 'Movimiento'),
          targetReps: null,
          loadKg: (m.loadKg != null ? Number(m.loadKg) : null),
          notes: m.notes ?? ''
        }));
        segs.push({ kind: 'time_driven', label: `AMRAP • ${amrapBlock.minutes ?? '?'} min`, movements });
      }

      const emomBlock = blocks.find(b => b.type === 'emom');
      if (emomBlock) {
        const movements: SegmentMovement[] = (emomBlock.perMinute ?? []).map((m: any) => ({
          name: String(m.name ?? 'Movimiento'),
          targetReps: null,
          loadKg: (m.loadKg != null ? Number(m.loadKg) : null),
          notes: m.notes ?? ''
        }));
        segs.push({ kind: 'time_driven', label: `EMOM • ${emomBlock.minutes ?? '?'} min`, movements });
      }

      const intervalBlock = blocks.find(b => b.type === 'interval');
      if (intervalBlock) {
        const movements: SegmentMovement[] = (intervalBlock.movements ?? []).map((m: any) => ({
          name: String(m.name ?? 'Movimiento'),
          targetReps: null,
          loadKg: (m.loadKg != null ? Number(m.loadKg) : null),
          notes: m.notes ?? ''
        }));
        segs.push({
          kind: 'time_driven',
          label: `INTERVAL • ${intervalBlock.rounds ?? '?'} rondas (${Math.round((intervalBlock.workSeconds ?? 0)/60)}' / ${Math.round((intervalBlock.restSeconds ?? 0)/60)}')`,
          movements
        });
      }

      const tabataBlock = blocks.find(b => b.type === 'tabata');
      if (tabataBlock) {
        const movements: SegmentMovement[] = (tabataBlock.movements ?? []).map((m: any) => ({
          name: String(m.name ?? 'Movimiento'),
          targetReps: null,
          loadKg: (m.loadKg != null ? Number(m.loadKg) : null),
          notes: m.notes ?? ''
        }));
        segs.push({
          kind: 'time_driven',
          label: `TABATA • ${tabataBlock.rounds ?? '?'} rondas (${Math.round((tabataBlock.workSeconds ?? 0)/60)}' / ${Math.round((tabataBlock.restSeconds ?? 0)/60)}')`,
          movements
        });
      }
    }

    const mode = (wod.scoringMode as any) ?? 'time';
    return {
      mode,
      capSeconds: capSeconds ?? totalDurationSeconds ?? null,
      totalDurationSeconds: totalDurationSeconds ?? null,
      segments: segs,
      isTimeDriven,
      isLift,
    };
  }

  /** Helpers de segmento */
  currentSegment(): CompiledSegment | null {
    const cw = this.compiledWod();
    if (!cw || !cw.segments.length) return null;
    const idx = Math.max(0, Math.min(this.segmentIndex(), cw.segments.length - 1));
    return cw.segments[idx] ?? null;
  }
  segmentMovements(): SegmentMovement[] {
    return this.currentSegment()?.movements ?? [];
  }
  segmentRepsDone(i: number): number {
    return this.segmentProgress[i] ?? 0;
  }
  isCurrentSegmentComplete(): boolean {
    const seg = this.currentSegment();
    if (!seg) return true;
    if (seg.kind !== 'reps_sequence') return true;
    for (let i = 0; i < seg.movements.length; i++) {
      const t = seg.movements[i].targetReps ?? 0;
      const d = this.segmentRepsDone(i);
      if (t > 0 && d < t) return false;
    }
    return true;
  }
  private isAllSequenceComplete(): boolean {
    const cw = this.compiledWod();
    if (!cw || !cw.segments.length) return false;
    return (this.segmentIndex() === cw.segments.length - 1) && this.isCurrentSegmentComplete();
  }
  canGoNextSegment(): boolean {
    const cw = this.compiledWod();
    if (!cw || cw.isTimeDriven || cw.isLift) return false;
    if (!this.scoreReady() || !this.scoreId()) return false;
    if (this.status() === 'finished' || this.status() === 'dnf') return false;
    return this.isCurrentSegmentComplete() && (this.segmentIndex() < cw.segments.length - 1);
  }
  nextSegment() {
    if (!this.canGoNextSegment()) return;
    this.segmentIndex.update(i => i + 1);
    this.segmentProgress = new Array(this.segmentMovements().length).fill(0);
  }

  /** Texto informativo para time-driven */
  timeDrivenLabel(): string {
    const wod = this.selectedWod;
    if (!wod) return '';
    const blocks = ((wod as any).blocks ?? []) as any[];
    if (blocks.some(b => b.type === 'amrap')) {
      const b = blocks.find(x => x.type === 'amrap');
      return `AMRAP • ${b?.minutes ?? '?'} min`;
    }
    if (blocks.some(b => b.type === 'emom')) {
      const b = blocks.find(x => x.type === 'emom');
      return `EMOM • ${b?.minutes ?? '?'} min`;
    }
    if (blocks.some(b => b.type === 'interval')) {
      const b = blocks.find(x => x.type === 'interval');
      return `INTERVAL • ${b?.rounds ?? '?'} rondas (${Math.round((b?.workSeconds ?? 0)/60)}' / ${Math.round((b?.restSeconds ?? 0)/60)}')`;
    }
    if (blocks.some(b => b.type === 'tabata')) {
      const b = blocks.find(x => x.type === 'tabata');
      return `TABATA • ${b?.rounds ?? '?'} rondas (${Math.round((b?.workSeconds ?? 0)/60)}' / ${Math.round((b?.restSeconds ?? 0)/60)}')`;
    }
    return '';
  }

  // ===== Timecap helpers =====
  private get capMs(): number | null {
    const cap = this.capSecondsVal ?? this.compiledWod()?.capSeconds ?? null;
    return cap && cap > 0 ? cap * 1000 : null;
  }

  /** Detiene estrictamente por timecap (idempotente) */
  private async stopByCap(elapsedMs: number): Promise<void> {
    if (!this.scoreId() || this.finishing) return;

    this.finishing = true;
    try {
      // Congela el tiempo en UI inmediatamente
      this.finalTimeMs.set(elapsedMs);
      this.status.set('finished');
      this.pausedOverride = false;
      this.stopTicker();

      // Persiste como finalizado con el tiempo exacto del cap
      await this.scoreSvc.finish(this.scoreId()!, elapsedMs);
    } catch (e) {
      console.error('stopByCap() error', e);
    } finally {
      this.finishing = false;
    }
  }

  // ======= Timer helpers =======
  private startTicker() {
    this.stopTicker();
    this.ticker = setInterval(() => {
      this.ngZone.run(() => {
        this.tick.update(v => v + 1);

        if (this.status() === 'running' && this.startedAt() && !this.pausedOverride) {
          const elapsed = Date.now() - (this.startedAt() as number);
          this.timeDisplay$.next(this.msToClock(elapsed));

          // === ENFORCE HARDCAP ===
          const capMillis = this.capMs;
          if (capMillis && elapsed >= capMillis) {
            this.stopByCap(capMillis).catch(console.error);
            return;
          }

          // Auto-finish por secuencia completada (solo secuencias por reps)
          const cw = this.compiledWod();
          if (cw && !cw.isTimeDriven && this.isAllSequenceComplete() && !this.finishing) {
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
    const normalizedCap = v.capSeconds ?? (this.compiledWod()?.capSeconds ?? null);

    const id = await this.scoreSvc.ensureScoreDoc({
      wodId: v.wodId!, wodName: v.wodName || '',
      scoringMode: (this.selectedWod?.scoringMode as any) || v.scoringMode!,
      category: v.category!, teamId: v.teamId!, teamName: v.teamName!,
      capSeconds: normalizedCap,
    });
    this.scoreId.set(id);
    this.scoreReady.set(true);
    this.currentLoad = 0;
    this.bindScore(id);
  }

  loading = false;

  // Reps globales (AMRAP/time-driven o soporte extra)
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

  // Mantengo estos métodos por compatibilidad; el juez no inicia/detiene desde UI
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
    if (!this.scoreId() || this.finishing) return;
    this.finishing = true;
    try {
      // Calcula elapsed actual si corresponde
      let elapsed = this.finalTimeMs() ?? 0;
      if (this.status() === 'running' && this.startedAt()) {
        elapsed = Date.now() - (this.startedAt() as number);
      }

      // Si hay cap, el tiempo final es el mínimo entre elapsed y cap
      const capMillis = this.capMs;
      const finalMs = capMillis ? Math.min(elapsed, capMillis) : elapsed;

      // Congela UI y persiste
      this.finalTimeMs.set(finalMs);
      this.status.set('finished');
      this.pausedOverride = false;
      this.stopTicker();

      await this.scoreSvc.finish(this.scoreId()!, finalMs);
    } catch (e: any) {
      console.error('finish() error', e);
    } finally {
      this.finishing = false;
    }
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

        // Sync cap y scoring si se actualizan desde fuera
        const capLocal = this.form.getRawValue().capSeconds;
        if (s.capSeconds != null && s.capSeconds !== capLocal) {
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
  canStop(): boolean { return this.scoreReady() && !!this.scoreId() && this.status() === 'running'; }
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

  isMovementComplete(i: number): boolean {
    const seg = this.currentSegment();
    if (!seg || seg.kind !== 'reps_sequence') return false;
    const target = seg.movements[i].targetReps ?? 0;
    return target > 0 && this.segmentRepsDone(i) >= target;
  }

  async incSegmentRep(movIndex: number) {
    const seg = this.currentSegment();
    if (!seg || seg.kind !== 'reps_sequence') return;
    if (this.isLockedForInputs() || this.isMovementComplete(movIndex)) return;

    // progreso local (optimista)
    const prev = this.segmentRepsDone(movIndex);
    const target = seg.movements[movIndex].targetReps ?? 0;

    if (target > 0 && prev < target) {
      this.segmentProgress[movIndex] = prev + 1;
      // cambia la referencia para asegurar render even con OnPush
      this.segmentProgress = [...this.segmentProgress];
      this.cdr.markForCheck();
    }

    try {
      // persiste en backend (suma al global)
      await this.incRep();
    } catch {
      // rollback si falló
      this.segmentProgress[movIndex] = prev;
      this.segmentProgress = [...this.segmentProgress];
      this.cdr.markForCheck();
      return;
    }

    // si el segmento quedó completo, avanzar o finalizar
    if (this.isCurrentSegmentComplete()) {
      const cw = this.compiledWod();
      if (cw && this.segmentIndex() === cw.segments.length - 1) {
        await this.finish();
      } else {
        this.nextSegment();
      }
    }
  }
}
