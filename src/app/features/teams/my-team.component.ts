import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { switchMap, map, of } from 'rxjs';
import { Category, Team } from '../../../core/models/team';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';

@Component({
  standalone: true,
  selector: 'app-my-team',
  imports: [
    CommonModule, MatButtonModule, MatSelectModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatListModule
  ],
  template: `
    <h2>Mi equipo</h2>

    <ng-container *ngIf="(auth.appUser$ | async) as user">
      <ng-container *ngIf="user.teamId as tid; else noTeam">
        <p><strong>Equipo actual:</strong> {{ (teamName$ | async) || 'Cargando...' }}</p>
        <button mat-raised-button color="warn" (click)="leave(tid)">Salir del equipo</button>
      </ng-container>

      <ng-template #noTeam>
        <p>No perteneces a ningún equipo.</p>

        <h3>Unirme a un equipo existente</h3>
        <mat-form-field appearance="outline">
          <mat-label>Categoría</mat-label>
          <mat-select [(value)]="joinCategory" (valueChange)="loadByCategory()">
            <mat-option value="RX">RX</mat-option>
            <mat-option value="Intermedio">Intermedio</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-nav-list *ngIf="teamsToJoin.length">
          <a mat-list-item *ngFor="let t of teamsToJoin" (click)="join(t.id)">
            {{ t.name }} — {{ t.category }} ({{ t.membersIds.length }} miembros)
          </a>
        </mat-nav-list>
        <p *ngIf="!teamsToJoin.length">No hay equipos en {{ joinCategory }} aún.</p>

        <h3>Crear equipo</h3>
        <form [formGroup]="form" (ngSubmit)="create()">
          <mat-form-field appearance="outline" class="w">
            <mat-label>Nombre del equipo</mat-label>
            <input matInput formControlName="name"/>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w">
            <mat-label>Categoría</mat-label>
            <mat-select formControlName="category">
              <mat-option value="RX">RX</mat-option>
              <mat-option value="Intermedio">Intermedio</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-raised-button color="primary" [disabled]="form.invalid || loading">
            {{ loading ? 'Creando...' : 'Crear y unirme' }}
          </button>
        </form>
      </ng-template>
    </ng-container>
  `,
  styles: [`.w{width:100%;max-width:400px;display:block}`]
})
export class MyTeamComponent {
  teamsSvc = inject(TeamService);
  auth = inject(AuthService);
  fb = inject(FormBuilder);

  loading = false;
  joinCategory: Category = 'RX';
  teamsToJoin: Team[] = [];
  teamName$ = this.auth.appUser$.pipe(
    switchMap(u => u?.teamId ? this.teamsSvc.getById$(u.teamId) : of(null)),
    map(t => t?.name || null)
  );

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['RX' as Category, [Validators.required]],
  });

  constructor() {
    this.loadByCategory();
  }

  loadByCategory() {
    this.teamsSvc.listByCategory$(this.joinCategory).subscribe(ts => this.teamsToJoin = ts);
  }

  async join(teamId: string) {
    try {
      await this.teamsSvc.joinTeam(teamId);
      alert('¡Te uniste al equipo!');
    } catch (e: any) {
      alert(e?.message || 'Error al unirse');
    }
  }

  async leave(teamId: string) {
    try {
      await this.teamsSvc.leaveTeam(teamId);
      alert('Has salido del equipo.');
    } catch (e: any) {
      alert(e?.message || 'Error al salir');
    }
  }

  async create() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const { name, category } = this.form.getRawValue();
      const id = await this.teamsSvc.create(name!, category!);
      await this.teamsSvc.joinTeam(id);
    } catch (e: any) {
      alert(e?.message || 'Error al crear equipo');
    } finally {
      this.loading = false;
    }
  }
}
