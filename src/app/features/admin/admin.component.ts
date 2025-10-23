import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  standalone: true,
  selector: 'app-admin',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule],
  template: `
    <div class="container">
      <mat-card class="card">
        <h2>Panel de Administración 🏋️‍♂️</h2>
        <p>Selecciona una sección para gestionar:</p>

        <div class="actions">
          <button mat-raised-button color="primary" routerLink="/admin/teams">
            Gestionar Equipos
          </button>

          <!-- Futuras secciones (ej. WODs, leaderboard, etc.) -->
          <button mat-stroked-button color="accent" routerLink="/admin/wods">
            Gestionar WODs
          </button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      justify-content: center;
      padding: 3rem;
    }

    .card {
      padding: 2rem;
      text-align: center;
      width: 100%;
      max-width: 500px;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 2rem;
    }
  `],
})
export class AdminComponent {}
