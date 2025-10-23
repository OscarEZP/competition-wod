import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule, RouterLink],
  template: `
    <div class="container">
      <h1>CrossFit Competition App 🏋️</h1>

      <!-- Usuario autenticado -->
      <ng-container *ngIf="(auth.appUser$ | async) as user; else loggedOut">
        <p>Hola, {{ user.displayName || user.email }} (rol: {{ user.role }})</p>

        <!-- Botones comunes -->
        <div class="actions">
            <a mat-raised-button color="primary" routerLink="/dashboard">Dashboard</a>

            <a mat-raised-button color="primary" routerLink="/leaderboard">Tablero de resultados</a>
            <a mat-raised-button color="accent" routerLink="/my-team">
                Ver / Unirme a un equipo
            </a>

            <!-- Botón Panel Admin (solo admins) -->
            <a *ngIf="user.role === 'admin'" mat-raised-button color="warn" routerLink="/admin" style="margin-left: 8px;">
                Panel Admin
            </a>

            <!-- ✅ Nuevo: Panel de Juez (admin o juez) -->
            <a *ngIf="user.role === 'admin' || user.role === 'judge'"
                mat-raised-button color="accent" routerLink="/judge" style="margin-left: 8px;">
                Panel de Juez
            </a>

            <button mat-raised-button (click)="logout()" style="margin-left: 8px;">
                Salir
            </button>
            </div>
      </ng-container>

      <!-- Usuario no autenticado -->
      <ng-template #loggedOut>
        <a mat-raised-button color="primary" routerLink="/auth/login">Entrar</a>
        <a mat-raised-button style="margin-left: 8px;" routerLink="/auth/register">Crear cuenta</a>
      </ng-template>
    </div>
  `,
  styles: [`
    .container {
      text-align: center;
      margin-top: 5rem;
      display: grid;
      gap: 12px;
      justify-content: center;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1rem;
      margin-top: 1rem;
    }
  `],
})
export class HomeComponent {
  auth = inject(AuthService);

  logout() {
    this.auth.logout();
  }
}
