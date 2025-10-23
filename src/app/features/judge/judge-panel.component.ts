// src/app/features/judge/judge-panel.component.ts
import { Component, inject, signal } from '@angular/core';
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

      <!-- Selector de Equipo (rellena teamId / teamName) -->
      <mat-form-field class="col-2">
        <mat-label>Equipo</mat-label>
        <mat-select [value]="form.value.teamId || null" (selectionChange)="onSelectTeam($event.value)">
          <mat-option *ngFor="let t of teams()" [value]="t.id">
            {{ t.name }} — {{ t.category }} ({{ t.membersIds.length }} miembros)
          </mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Campos de sólo lectura (rellenos al elegir equipo) -->
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
    </div>

    <!-- Controles dinámicos según scoring -->
    <div class="controls" *ngIf="scoreReady()">
      <!-- TIEMPO -->
      <div class="timer" *ngIf="form.value.scoringMode === 'time'">
        <div class="time">{{ displayTime() }}</div>
        <button mat-raised-button color="primary" (click)="startTimer()" [disabled]="isLocked()">Start</button>
        <button mat-raised-button color="warn" (click)="stopTimer()" [disabled]="isLocked()">Stop</button>
        <button mat-stroked-button (click)="finish()" [disabled]="isLocked()">Finalizar</button>
        <button mat-stroked-button color="warn" (click)="markDNF()" [disabled]="isLocked()">DNF</button>

      </div>

      <!-- REPETICIONES -->
      <div class="reps" *ngIf="form.value.scoringMode === 'reps' || form.value.scoringMode === 'time'">
        <div>Reps: <strong>{{ reps() }}</strong> | No-Reps: <strong>{{ noReps() }}</strong></div>
        <button mat-raised-button (click)="incRep()" [disabled]="isLocked() || isFinishedOrDNF()">+ rep</button>
        <button mat-raised-button (click)="incNoRep()" [disabled]="isLocked() || isFinishedOrDNF()">+ no-rep</button>

      </div>

      <!-- CARGA -->
      <div class="load" *ngIf="form.value.scoringMode === 'load'">
        <div>Mejor carga: <strong>{{ maxLoad() ?? 0 }}</strong> kg</div>
        <div class="row">
          <input type="number" [(ngModel)]="currentLoad" placeholder="Carga (kg)" />
          <button mat-stroked-button (click)="saveAttempt()" [disabled]="isLocked() || isFinishedOrDNF()">Guardar intento</button>

        </div>
        <div class="row">
          <button mat-raised-button color="accent" (click)="finish()" [disabled]="isLocked()">Finalizar</button>
          <button mat-stroked-button color="warn" (click)="markDNF()" [disabled]="isLocked()">DNF</button>

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
export class JudgePanelComponent {
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
  ticker?: any;

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
    // Cargar WODs al iniciar
    this.wodsSvc.listAll$().subscribe(ws => this.wods.set(ws));

    // Cargar equipos por categoría reactivo
    this.form.get('category')!.valueChanges.subscribe((cat) => {
      this.onCategoryChange((cat || 'RX') as Category);
    });
    // primera carga
    this.onCategoryChange(this.form.value.category || 'RX');
  }

  // ======= Equipos =======
  onCategoryChange(cat: Category) {
    this.loadTeamsByCategory(cat);
    // limpiar selección de equipo al cambiar categoría
    this.form.patchValue({ teamId: '', teamName: '' });
  }

  private loadTeamsByCategory(category: Category) {
    this.teamSvc.listByCategory$(category).subscribe(ts => this.teams.set(ts));
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

    const emom = wod.blocks.find(b => b.type === 'emom') as any;
    if (emom?.minutes) return Number(emom.minutes) * 60;

    return null;
  }

  // ======= UI tiempo =======
  displayTime() {
    if (this.startedAt() && !this.finalTimeMs()) {
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

    // Reset local (si luego te suscribes al score doc, esto se puede quitar)
    this.reps.set(0);
    this.noReps.set(0);
    this.currentLoad = 0;
    this.maxLoad.set(null);
    this.startedAt.set(null);
    this.finalTimeMs.set(null);

    this.bindScore(id);
  }

  async incRep() {
    if (!this.scoreId()) { await this.prepareScore(); }
    await this.scoreSvc.incrementReps(this.scoreId()!);
    this.reps.update(v => v + 1);
  }

  async incNoRep() {
    if (!this.scoreId()) { await this.prepareScore(); }
    await this.scoreSvc.incrementNoReps(this.scoreId()!);
    this.noReps.update(v => v + 1);
  }

  async saveAttempt() {
    if (!this.scoreId()) { await this.prepareScore(); }
    const load = Number(this.currentLoad) || 0;
    await this.scoreSvc.addLoadAttempt(this.scoreId()!, load);
    this.maxLoad.set(Math.max(this.maxLoad() ?? 0, load));
  }

  async startTimer() {
    if (!this.scoreId()) { await this.prepareScore(); }
    await this.scoreSvc.start(this.scoreId()!);
    this.startedAt.set(Date.now());
    this.finalTimeMs.set(null);
    clearInterval(this.ticker);
    this.ticker = setInterval(() => {/* refresco visual */}, 100);
  }

  async stopTimer() {
    if (!this.scoreId()) return;
    await this.scoreSvc.stop(this.scoreId()!);
    if (this.startedAt()) {
      const elapsed = Date.now() - (this.startedAt() as number);
      this.finalTimeMs.set(elapsed);
    }
    clearInterval(this.ticker);
  }

  async finish() {
    if (!this.scoreId()) return;
    await this.scoreSvc.finish(this.scoreId()!);
    clearInterval(this.ticker);
    alert('Finalizado');
  }

  async markDNF() {
    if (!this.scoreId()) return;
    await this.scoreSvc.markDNF(this.scoreId()!);
    clearInterval(this.ticker);
    alert('DNF marcado');
  }

  private bindScore(id: string) {
    // limpia suscripción previa
    this.scoreSub?.unsubscribe();
    this.scoreSub = this.scoreSvc.watch$(id).subscribe(s => {
      if (!s) return;

      // reflejar contadores/tiempo/carga desde BD
      this.reps.set(s.reps || 0);
      this.noReps.set(s.noReps || 0);
      this.maxLoad.set(s.maxLoadKg ?? null);

      // tiempo: si está corriendo, mostramos tiempo en vivo
      if (s.status === 'running' && s.startedAt) {
        this.startedAt.set(s.startedAt);
        this.finalTimeMs.set(null);
        clearInterval(this.ticker);
        this.ticker = setInterval(() => {/* paint */}, 100);
      } else {
        // si finished trae finalTimeMs, o DNF/not_started
        this.startedAt.set(s.startedAt ?? null);
        this.finalTimeMs.set(s.finalTimeMs ?? null);
        clearInterval(this.ticker);
      }

      // también reflejar scoring/cap si otro juez los cambió
      if (s.capSeconds != null && s.capSeconds !== this.form.value.capSeconds) {
        this.form.patchValue({ capSeconds: s.capSeconds }, { emitEvent: false });
      }
      if (s.scoringMode && s.scoringMode !== this.form.value.scoringMode) {
        this.form.patchValue({ scoringMode: s.scoringMode as any }, { emitEvent: false });
      }
    });
  }

  isLocked(): boolean {
    // no permitir cambios si el score no está preparado o si terminó/DNF
    const locked = !this.scoreReady() || !this.scoreId();
    return locked;
  }

  isFinishedOrDNF(): boolean {
    // si tenemos los datos live, inferimos del UI
    // como simplificación, bloqueamos acciones cuando finalizamos/parado sin startedAt y con finalTime
    // pero mejor leer del doc live: usa scoreSub → podrías guardar s.status en una signal si prefieres
    // aquí reutilizamos finalTimeMs como proxy (si existe y no está running)
    return !!(this.finalTimeMs());
  }

  ngOnDestroy() {
    this.scoreSub?.unsubscribe();
    clearInterval(this.ticker);
  }


}
