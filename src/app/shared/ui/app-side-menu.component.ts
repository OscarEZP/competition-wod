// src/app/shared/ui/app-side-menu.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

export type Role = 'admin' | 'judge' | 'athlete' | 'user' | string;

export interface AppUserLike {
    email?: string | null;
    displayName?: string | null;
    role?: Role;
}

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink, RouterLinkActive,
    MatListModule, MatIconModule, MatDividerModule, MatButtonModule, MatChipsModule
  ],
  template: `
    <div class="side-header">
      <div class="brand">CF</div>
      <div class="brand-txt">
        <strong>CrossFit</strong>
        <span>Competition</span>
      </div>
    </div>

    <!-- Usuario autenticado -->
    <ng-container *ngIf="user; else guestMenu">
      <mat-nav-list>
        <a mat-list-item routerLink="/dashboard" routerLinkActive="active" (click)="item.emit()">
          <mat-icon matListItemIcon>dashboard</mat-icon>
          <span matListItemTitle>Dashboard</span>
        </a>

        <a mat-list-item routerLink="/leaderboard" routerLinkActive="active" (click)="item.emit()">
          <mat-icon matListItemIcon>leaderboard</mat-icon>
          <span matListItemTitle>Tablero</span>
        </a>

        <a mat-list-item routerLink="/my-team" routerLinkActive="active" (click)="item.emit()">
          <mat-icon matListItemIcon>group</mat-icon>
          <span matListItemTitle>Mi equipo</span>
        </a>

        <!-- Administración -->
        <ng-container *ngIf="user?.role === 'admin'">
          <mat-divider></mat-divider>
          <div mat-subheader class="subheader">Administración</div>

          <a mat-list-item routerLink="/admin/wods" routerLinkActive="active" (click)="item.emit()">
            <mat-icon matListItemIcon>fitness_center</mat-icon>
            <span matListItemTitle>Admin WODs</span>
          </a>

          <a mat-list-item routerLink="/admin/teams" routerLinkActive="active" (click)="item.emit()">
            <mat-icon matListItemIcon>groups</mat-icon>
            <span matListItemTitle>Admin Teams</span>
          </a>

          <a mat-list-item routerLink="/admin/users" routerLinkActive="active" (click)="item.emit()">
            <mat-icon matListItemIcon>groups</mat-icon>
            <span matListItemTitle>Admin Users</span>
          </a>
        </ng-container>

        <!-- Panel Juez -->
        <a *ngIf="user?.role === 'admin' || user?.role === 'judge'"
           mat-list-item routerLink="/judge" routerLinkActive="active" (click)="item.emit()">
          <mat-icon matListItemIcon>gavel</mat-icon>
          <span matListItemTitle>Panel Juez</span>
        </a>

        <mat-divider></mat-divider>

        <button mat-list-item (click)="logout.emit(); item.emit()">
          <mat-icon matListItemIcon>logout</mat-icon>
          <span matListItemTitle>Salir</span>
        </button>
      </mat-nav-list>

      <div class="side-footer">
        <div class="user">
          <mat-icon>account_circle</mat-icon>
          <div class="meta">
            <div class="name">{{ user.displayName }}</div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- Invitado -->
    <ng-template #guestMenu>
      <mat-nav-list>
        <a mat-list-item routerLink="/auth/login" (click)="item.emit()">
          <mat-icon matListItemIcon>login</mat-icon>
          <span matListItemTitle>Entrar</span>
        </a>
        <a mat-list-item routerLink="/auth/register" (click)="item.emit()">
          <mat-icon matListItemIcon>person_add</mat-icon>
          <span matListItemTitle>Crear cuenta</span>
        </a>
      </mat-nav-list>
    </ng-template>
  `,
  styles: [`
    .side-header { display:flex; align-items:center; gap:10px; padding:16px 14px; }
    .brand { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color:#fff; font-weight:800; background:#FC5500; }
    .brand-txt span { color:#6b7280; font-size:.85rem; }
    .side-footer { margin-top:auto; padding:12px 14px; border-top:1px solid #eee; }
    .user { display:flex; gap:10px; align-items:center; color:#1d1d1f; }
    .user .meta .name { font-weight:600; }
    .user .meta .role { font-size:.85rem; color:#6b7280; }
    .subheader { padding-inline: 16px; font-weight: 700; color:#374151; }
  `]
})
export class AppSideMenuComponent {
  @Input() user: AppUserLike | null = null;

  /** Se emite en cada click de ítem para que el padre cierre el drawer en móvil */
  @Output() item = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

}
