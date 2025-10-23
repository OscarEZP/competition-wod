import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { TeamService } from '../../../../core/services/team.service';
import { Category, Team } from '../../../../core/models/team';

@Component({
  standalone: true,
  selector: 'app-admin-teams',
  imports: [
    CommonModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    ReactiveFormsModule,
    FormsModule, // 👈 agrega esto
  ],
  template: `
    <h2>Equipos (Admin)</h2>

    <!-- Crear equipo -->
    <form [formGroup]="form" (ngSubmit)="create()" class="row">
      <mat-form-field appearance="outline" class="w">
        <mat-label>Nombre</mat-label>
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
        {{ loading ? 'Creando...' : 'Crear equipo' }}
      </button>
    </form>

    <!-- Listado -->
    <table mat-table [dataSource]="teams" class="mt">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Equipo</th>
        <td mat-cell *matCellDef="let t">
          <input *ngIf="editId===t.id; else viewName"
                 matInput [(ngModel)]="editName" />
          <ng-template #viewName>{{ t.name }}</ng-template>
        </td>
      </ng-container>

      <ng-container matColumnDef="category">
        <th mat-header-cell *matHeaderCellDef>Categoría</th>
        <td mat-cell *matCellDef="let t">
          <ng-container *ngIf="editId===t.id; else viewCat">
            <mat-select [(ngModel)]="editCategory">
              <mat-option value="RX">RX</mat-option>
              <mat-option value="Intermedio">Intermedio</mat-option>
            </mat-select>
          </ng-container>
          <ng-template #viewCat>{{ t.category }}</ng-template>
        </td>
      </ng-container>

      <ng-container matColumnDef="members">
        <th mat-header-cell *matHeaderCellDef>Miembros</th>
        <td mat-cell *matCellDef="let t">{{ t.membersIds.length }}</td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>Acciones</th>
        <td mat-cell *matCellDef="let t">
          <button *ngIf="editId!==t.id" mat-button (click)="startEdit(t)">Editar</button>
          <button *ngIf="editId===t.id" mat-button color="primary" (click)="saveEdit(t)">Guardar</button>
          <button *ngIf="editId===t.id" mat-button (click)="cancelEdit()">Cancelar</button>
          <button mat-button color="warn" (click)="remove(t)">Eliminar</button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr 200px auto; gap: 12px; align-items: end; max-width: 720px; }
    .w { width: 100%; }
    .mt { margin-top: 24px; width: 100%; max-width: 900px; }
  `]
})
export class AdminTeamsComponent {
  private fb = inject(FormBuilder);
  private teamsSvc = inject(TeamService);

  loading = false;
  teams: Team[] = [];
  cols = ['name', 'category', 'members', 'actions'];

  editId: string | null = null;
  editName = '';
  editCategory: Category = 'RX';

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['RX' as Category, [Validators.required]],
  });

  constructor() {
    this.teamsSvc.listAll$().subscribe(ts => this.teams = ts);
  }

  async create() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const { name, category } = this.form.getRawValue();
      await this.teamsSvc.create(name!, category!);
      this.form.reset({ name: '', category: 'RX' });
    } catch (e: any) {
      alert(e?.message || 'Error creando equipo');
    } finally {
      this.loading = false;
    }
  }

  startEdit(t: Team) {
    this.editId = t.id;
    this.editName = t.name;
    this.editCategory = t.category;
  }

  cancelEdit() {
    this.editId = null;
  }

  async saveEdit(t: Team) {
    if (!this.editId) return;
    await this.teamsSvc.update(t.id, { name: this.editName, category: this.editCategory });
    this.editId = null;
  }

  async remove(t: Team) {
    if (!confirm(`Eliminar equipo "${t.name}"?`)) return;
    await this.teamsSvc.remove(t.id);
  }
}
