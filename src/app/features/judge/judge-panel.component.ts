// src/app/features/judge/judge-panel.component.ts
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Team, Category } from '../../../core/models/team';
import { Wod } from '../../../core/models/wod';
import { ScoreService } from '../../../core/services/score.service';
import { TeamService } from '../../../core/services/team.service';
import { WodService } from '../../../core/services/wod.service';
import { Subscription } from 'rxjs';

// ahora soportamos 'paused' para poder detener sin cerrar
type ScoreStatus = 'not_started' | 'running' | 'paused' | 'finished' | 'dnf';

@Component({
  standalone: true,
  selector: 'app-judge-panel',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
  <h2>Panel de Juez</h2>

  <mat-card class="card">
    <form [formGroup]="form" class="grid">
      <!-- Selector de WOD -->
      <mat-form-field>
        <mat-label>WOD</mat-label>
        <mat-select formControlName="wodId" (selectionChange)="onSelectWod($event.value)">
          <mat-option *ngFor="let w of wods()" [value]="w.id">
            {{ w.name }} — {{ w.category }} ({{ w.scoringMode }})
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field>
        <mat-label>WOD Nombre</mat-label>
        <input matInput formControlName="wodName" readonly />
      </mat-form-field>

      <mat-form-field>
        <mat-label>Scoring</mat-label>
        <input matInput formControlName="scoringMode" readonly />
      </mat-form-field>

      <!-- Categoría afecta el listado de equipos -->
      <mat-form-field>
        <mat-label>Categoría</mat-label>
        <mat-select formControlName="category" (selectionChange)="onCategoryChange($event.value)">
          <mat-option value="RX">RX</mat-option>
          <mat-option value="Intermedio">Intermedio</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Selector de Equipo -->
      <mat-form-field class="col-2">
        <mat-label>Equipo</mat-label>
        <mat-select [value]="form.value.teamId || null" (selectionChange)="onSelectTeam($event.value)">
          <mat-option *ngFor="let t of teams()" [value]="t.id">
            {{ t.name }} — {{ t.category }} ({{ t.membersIds.length }} miembros)
          </mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Solo lectura -->
      <mat-form-field>
        <mat-label>Equipo ID</mat-label>
        <input matInput formControlName="teamId" readonly />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Equipo Nombre</mat-label>
        <input matInput formControlName="teamName" readonly />
      </mat-form-field>

      <mat-form-field>
        <mat-label>Cap (segundos)</mat-label>
        <input type="number" matInput formControlName="capSeconds" />
      </mat-form-field>
    </form>

    <div class="row">
      <button mat-raised-button color="primary" (click)="prepareScore()"
        [disabled]="!form.value.wodId || !form.value.teamId || !form.value.teamName">
        Preparar score
      </button>
      <span *ngIf="scoreId()">Score ID: {{ scoreId() }}</span>
      <span *ngIf="status()"> • Estado: {{ status() }}</span>
    </div>

    <!-- Controles dinámicos según scoring -->
    <div class="controls" *ngIf="scoreReady()">
      <!-- TIEMPO -->
      <div class="timer" *ngIf="form.value.scoringMode === 'time'">
        <div class="time">{{ displayTime() }}</div>

        <button mat-raised-button color="primary"
          (click)="startTimer()"
          [disabled]="!canStart()">Start</button>

        <button mat-raised-button color="warn"
          (click)="stopTimer()"
          [disabled]="!canStop()">Stop</button>

        <button mat-stroked-button
          (click)="finish()"
          [disabled]="!canFinish()">Finalizar</button>

        <button mat-stroked-button color="warn"
          (click)="markDNF()"
          [disabled]="!canDNF()">DNF</button>
      </div>

      <!-- REPETICIONES -->
      <div class="reps" *ngIf="form.value.scoringMode === 'reps' || form.value.scoringMode === 'time'">
        <div>Reps: <strong>{{ reps() }}</strong> | No-Reps: <strong>{{ noReps() }}</strong></div>
        <button mat-raised-button (click)="incRep()" [disabled]="isLockedForInputs()">+ rep</button>
        <button mat-raised-button (click)="incNoRep()" [disabled]="isLockedForInputs()">+ no-rep</button>
      </div>

      <!-- CARGA -->
      <div class="load" *ngIf="form.value.scoringMode === 'load'">
        <div>Mejor carga: <strong>{{ maxLoad() ?? 0 }}</strong> kg</div>
        <div class="row">
          <input type="number" [(ngModel)]="currentLoad" placeholder="Carga (kg)" />
          <button mat-stroked-button (click)="saveAttempt()" [disabled]="isLockedForInputs()">Guardar intento</button>
        </div>
        <div class="row">
          <button mat-raised-button color="accent" (click)="finish()" [disabled]="!canFinish()">Finalizar</button>
          <button mat-stroked-button color="warn" (click)="markDNF()" [disabled]="!canDNF()">DNF</button>
        </div>
      </div>
      <div *ngIf="maxLoad() != null" class="row">Máximo actual: {{ maxLoad() }} kg</div>
    </div>
  </mat-card>
  `,
  styles: [`
    .card { padding: 16px; max-width: 980px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(200px, 1fr)); gap: 12px; }
    .col-2 { grid-column: span 2; }
    .controls { display: grid; gap: 16px; margin-top: 16px; }
    .timer { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .time { font-size: 1.4rem; min-width: 120px; text-align: center; }
    .reps, .load { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  `]
})
export class JudgePanelComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private wodsSvc = inject(WodService);
  private scoreSvc = inject(ScoreService);
  private teamSvc = inject(TeamService);

  private scoreSub?: Subscription;

  // WODs y Teams (signals)
  wods = signal<Wod[]>([]);
  teams = signal<Team[]>([]);
  selectedWod: Wod | null = null;

  // Estado de UI local
  reps = signal(0);
  noReps = signal(0);
  currentLoad = 0;
  maxLoad = signal<number | null>(null);
  startedAt = signal<number | null>(null);
  finalTimeMs = signal<number | null>(null);
  status = signal<ScoreStatus>('not_started');

  // ticker reactivo + protección contra snapshots "viejos"
  tick = signal(0);
  private ticker?: any;
  private pausedOverride = false; // 👈 evita que un snapshot con running re-arranque tras STOP

  // score actual
  scoreId = signal<string | null>(null);
  scoreReady = signal(false);

  form = this.fb.group({
    wodId: ['', Validators.required],
    wodName: [''],
    scoringMode: ['time' as 'time'|'reps'|'load', Validators.required],
    category: ['RX' as Category, Validators.required],
    teamId: ['', Validators.required],
    teamName: ['', Validators.required],
    capSeconds: [null as number | null],
  });

  constructor() {
    this.wodsSvc.listAll$().subscribe(ws => this.wods.set(ws));
    this.form.get('category')!.valueChanges.subscribe((cat) => {
      this.onCategoryChange((cat || 'RX') as Category);
    });
    this.onCategoryChange(this.form.value.category || 'RX');
  }

  // ======= Equipos =======
  onCategoryChange(cat: Category) {
    this.teamSvc.listByCategory$(cat).subscribe(ts => this.teams.set(ts));
    this.form.patchValue({ teamId: '', teamName: '' });
  }

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
    });
  }

  deriveCapSecondsFromBlocks(wod: Wod | null): number | null {
    if (!wod) return null;
    const capBlock = wod.blocks.find(b => (b as any).capSeconds != null) as any;
    if (capBlock?.capSeconds != null) return Number(capBlock.capSeconds);
    const amrap = wod.blocks.find(b => b.type === 'amrap') as any;
    if (amrap?.minutes) return Number(amrap.minutes) * 60;
    const emom  = wod.blocks.find(b => b.type === 'emom') as any;
    if (emom?.minutes)  return Number(emom.minutes) * 60;
    return null;
  }

  // ======= Timer helpers =======
  private startTicker() {
    clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      this.tick.update(v => v + 1);

      // auto-cap
      const cap = (this.form.value.capSeconds ?? null);
      if (!this.pausedOverride && this.status() === 'running' && this.startedAt() && cap && cap > 0) {
        const elapsed = Date.now() - (this.startedAt() as number);
        if (elapsed >= cap * 1000) this.finish().catch(() => {});
      }
    }, 100);
  }
  private stopTicker() { clearInterval(this.ticker); }

  displayTime() {
    this.tick(); // fuerza recomputo periódicamente
    if (this.status() === 'running' && this.startedAt() && !this.pausedOverride) {
      const elapsed = Date.now() - (this.startedAt() as number);
      return this.msToClock(elapsed);
    }
    return this.msToClock(this.finalTimeMs() ?? 0);
  }
  msToClock(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
  }

  // ======= Flujo =======
  async prepareScore() {
    const v = this.form.getRawValue();
    if (!v.wodId || !v.teamId || !v.teamName) {
      alert('Selecciona WOD y equipo');
      return;
    }
    const id = await this.scoreSvc.ensureScoreDoc({
      wodId: v.wodId!,
      wodName: v.wodName || '',
      scoringMode: v.scoringMode!,
      category: v.category!,
      teamId: v.teamId!,
      teamName: v.teamName!,
      capSeconds: v.capSeconds ?? null,
    });
    this.scoreId.set(id);
    this.scoreReady.set(true);
    this.currentLoad = 0;
    this.bindScore(id);
  }

  async incRep() {
    if (!this.scoreId()) { await this.prepareScore(); }
    await this.scoreSvc.incrementReps(this.scoreId()!);
  }
  async incNoRep() {
    if (!this.scoreId()) { await this.prepareScore(); }
    await this.scoreSvc.incrementNoReps(this.scoreId()!);
  }
  async saveAttempt() {
    if (!this.scoreId()) { await this.prepareScore(); }
    const load = Number(this.currentLoad) || 0;
    await this.scoreSvc.addLoadAttempt(this.scoreId()!, load);
  }

  async startTimer() {
    if (!this.scoreId()) { await this.prepareScore(); }

    // reanudar desde pausa (usa el tiempo congelado)
    if (this.status() === 'paused' && this.finalTimeMs()) {
      const resumeStart = Date.now() - (this.finalTimeMs() as number);
      this.startedAt.set(resumeStart);
      this.finalTimeMs.set(null);
    }

    this.pausedOverride = false;
    this.status.set('running');
    if (!this.startedAt()) this.startedAt.set(Date.now()); // optimista
    this.startTicker();

    await this.scoreSvc.start(this.scoreId()!);
  }

  async stopTimer() {
    if (!this.scoreId()) return;
    if (this.status() !== 'running') return;

    // PAUSA INMEDIATA (UI)
    if (this.startedAt()) {
      const elapsed = Date.now() - (this.startedAt() as number);
      this.finalTimeMs.set(elapsed);
    }
    this.status.set('paused');
    this.pausedOverride = true;  // 👈 evita que un snapshot viejo con 'running' re-arranque
    this.stopTicker();

    // Persiste la pausa (ideal: que el servicio guarde status='paused' y/o finalTimeMs)
    await this.scoreSvc.stop(this.scoreId()!);
  }

  async finish() {
    if (!this.scoreId()) return;

    // si iba corriendo y no había final, calcúlalo
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
    this.scoreSub = this.scoreSvc.watch$(id).subscribe(s => {
      if (!s) return;

      // contadores/carga
      this.reps.set(s.reps || 0);
      this.noReps.set(s.noReps || 0);
      this.maxLoad.set(s.maxLoadKg ?? null);

      const nextStatus = (s.status as ScoreStatus) || 'not_started';

      // si el usuario pulsó STOP (pausedOverride=true), ignoramos temporalmente snapshots 'running'
      if (this.pausedOverride && nextStatus === 'running') {
        // no re-arrancamos ticker hasta que llegue un estado != running
        // mantenemos pantalla congelada
      } else {
        this.status.set(nextStatus);

        if (nextStatus === 'running' && s.startedAt) {
          this.startedAt.set(s.startedAt);
          this.finalTimeMs.set(null);
          this.startTicker();
        } else {
          this.startedAt.set(s.startedAt ?? null);
          this.finalTimeMs.set(s.finalTimeMs ?? (nextStatus === 'paused' && this.finalTimeMs() ? this.finalTimeMs() : null));
          this.stopTicker();
        }

        // si dejamos de ver running desde BD, liberamos el override
        if (this.pausedOverride && nextStatus !== 'running') {
          this.pausedOverride = false;
        }
      }

      // reflejar cambios remotos de cap/scoring
      if (s.capSeconds != null && s.capSeconds !== this.form.value.capSeconds) {
        this.form.patchValue({ capSeconds: s.capSeconds }, { emitEvent: false });
      }
      if (s.scoringMode && s.scoringMode !== this.form.value.scoringMode) {
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
  }
}
