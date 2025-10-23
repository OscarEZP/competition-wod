// src/app/features/leaderboard/leaderboard.component.ts
import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';

import { Score } from '../../../core/models/score';
import { ScoreService } from '../../../core/services/score.service';
import { Wod } from '../../../core/models/wod';
import { WodService } from '../../../core/services/wod.service';

@Component({
  standalone: true,
  selector: 'app-leaderboard',
  imports: [CommonModule, FormsModule, MatTableModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  template: `
    <h2>Leaderboard</h2>

    <div class="filters">
      <mat-form-field appearance="outline" class="wod">
        <mat-label>WOD</mat-label>
        <mat-select [(ngModel)]="wodId">
          <mat-option *ngFor="let w of wods" [value]="w.id">
            {{ w.name }} — {{ w.category }} ({{ w.scoringMode }})
          </mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-raised-button color="primary" (click)="load()" [disabled]="!wodId || !category">
        Ver clasificación
      </button>
    </div>

    <div class="meta" *ngIf="currentWod">
      <span><strong>WOD:</strong> {{ currentWod.name }}</span>
      <span>•</span>
      <span><strong>Scoring:</strong> {{ currentWod.scoringMode }}</span>
      <span *ngIf="currentWod.description">•</span>
      <span *ngIf="currentWod.description">{{ currentWod.description }}</span>
    </div>

    <table mat-table [dataSource]="rows" *ngIf="rows.length" class="table">
      <ng-container matColumnDef="pos">
        <th mat-header-cell *matHeaderCellDef>#</th>
        <td mat-cell *matCellDef="let r; let i = index">{{ i + 1 }}</td>
      </ng-container>

      <ng-container matColumnDef="team">
        <th mat-header-cell *matHeaderCellDef>Equipo</th>
        <td mat-cell *matCellDef="let r">{{ r.teamName }}</td>
      </ng-container>

      <ng-container matColumnDef="score">
        <th mat-header-cell *matHeaderCellDef>Resultado</th>
        <td mat-cell *matCellDef="let r">
          <ng-container [ngSwitch]="r.scoringMode">
            <span *ngSwitchCase="'time'">{{ fmtTime(r) }}</span>
            <span *ngSwitchCase="'reps'">{{ r.reps }} reps</span>
            <span *ngSwitchCase="'load'">{{ r.maxLoadKg || 0 }} kg<span *ngIf="r.reps"> ({{ r.reps }} reps)</span></span>
          </ng-container>
          <span *ngIf="r.status === 'dnf'">&nbsp;— DNF</span>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>

    <p *ngIf="rows.length === 0 && wodId" class="empty">
      Aún no hay resultados para este WOD en {{ category }}.
    </p>
  `,
  styles: [`
    .filters { display:flex; gap:12px; align-items:center; margin-bottom: 12px; flex-wrap: wrap; }
    .wod { min-width: 280px; }
    .cat { min-width: 160px; }
    .table { width: 100%; max-width: 1100px; }
    .meta { display:flex; gap:8px; align-items:center; margin: 8px 0 16px; opacity: 0.85; }
    .empty { opacity: 0.7; margin-top: 8px; }
  `]
})
export class LeaderboardComponent implements OnDestroy {
  private scoreSvc = inject(ScoreService);
  private wodsSvc = inject(WodService);
  private route = inject(ActivatedRoute);

  wods: Wod[] = [];
  currentWod: Wod | null = null;

  rows: Score[] = [];
  cols = ['pos', 'team', 'score'];

  wodId = '';
  category: 'RX' | 'Intermedio' = 'RX';

  private sub?: any;
  private wodsSub?: any;

  constructor() {
    // Carga todos los WODs para el selector
    this.wodsSub = this.wodsSvc.listAll$().subscribe(ws => {
      this.wods = ws;
      // si había un wodId (por query param), fija el currentWod
      if (this.wodId) this.currentWod = this.wods.find(w => w.id === this.wodId) || null;
    });

    // Lee query params opcionales (?wod=&category=) y autoload
    this.route.queryParams.subscribe(p => {
      const qWod = (p['wod'] || '') as string;
      if (qWod) this.wodId = qWod;
      if (this.wodId && this.category) this.load(); // carga automática
    });
  }

  load() {
    // Actualiza metadatos del WOD activo
    this.currentWod = this.wods.find(w => w.id === this.wodId) || null;

    // Cancela subscripción anterior y suscríbete en tiempo real
    this.sub?.unsubscribe?.();
    this.sub = this.scoreSvc
      .listForWod$(this.wodId)
      .subscribe(r => {
        // r ya viene ordenado por rankPrimary/Secondary (mejor -> peor)
        this.rows = r;
      });
  }

  fmtTime(r: Score) {
    const ms = r.finalTimeMs ?? 0;
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    const sec = s % 60, cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe?.();
    this.wodsSub?.unsubscribe?.();
  }
}
