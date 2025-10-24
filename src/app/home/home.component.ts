import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }    from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule }    from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatToolbarModule, MatSidenavModule, MatListModule, MatDividerModule
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <!-- Lateral -->
      <mat-sidenav
        #drawer
        class="side"
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="!(isHandset$ | async)"
      >
        <div class="side-header">
          <div class="brand">CF</div>
          <div class="brand-txt">
            <strong>CrossFit</strong>
            <span>Competition</span>
          </div>
        </div>

        <!-- Usuario autenticado -->
        <ng-container *ngIf="(auth.appUser$ | async) as user; else guestMenu">
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>

            <a mat-list-item routerLink="/leaderboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>leaderboard</mat-icon>
              <span matListItemTitle>Tablero</span>
            </a>

            <a mat-list-item routerLink="/my-team" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>group</mat-icon>
              <span matListItemTitle>Mi equipo</span>
            </a>

            <a *ngIf="user.role === 'admin'" mat-list-item routerLink="/admin" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
              <span matListItemTitle>Admin</span>
            </a>

            <a *ngIf="user.role === 'admin' || user.role === 'judge'" mat-list-item routerLink="/judge" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>gavel</mat-icon>
              <span matListItemTitle>Panel Juez</span>
            </a>

            <mat-divider></mat-divider>

            <button mat-list-item (click)="logout(); closeOnMobile(drawer)">
              <mat-icon matListItemIcon>logout</mat-icon>
              <span matListItemTitle>Salir</span>
            </button>
          </mat-nav-list>

          <div class="side-footer">
            <div class="user">
              <mat-icon>account_circle</mat-icon>
              <div class="meta">
                <div class="name">{{ user.displayName || user.email }}</div>
                <div class="role">Rol: {{ user.role }}</div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Invitado -->
        <ng-template #guestMenu>
          <mat-nav-list>
            <a mat-list-item routerLink="/auth/login" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>login</mat-icon>
              <span matListItemTitle>Entrar</span>
            </a>
            <a mat-list-item routerLink="/auth/register" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>person_add</mat-icon>
              <span matListItemTitle>Crear cuenta</span>
            </a>
          </mat-nav-list>
        </ng-template>
      </mat-sidenav>

      <!-- Contenido -->
      <mat-sidenav-content class="content">
        <!-- Header fijo -->
        <mat-toolbar class="app-toolbar" color="primary">
          <button
            type="button"
            mat-icon-button
            aria-label="Abrir menú"
            (click)="drawer.toggle()"
            class="only-handset"
          >
            <mat-icon>menu</mat-icon>
          </button>

          <div class="toolbar-title">
            <span class="logo">CF</span>
            <span class="title">Competition App</span>
          </div>

          <span class="spacer"></span>

          <!-- Acciones rápidas (ocultas en mobile) -->
          <div class="toolbar-actions hide-handset">
            <a mat-button routerLink="/dashboard">Dashboard</a>
            <a mat-button routerLink="/leaderboard">Tablero</a>
            <a mat-button routerLink="/my-team">Mi equipo</a>
          </div>
        </mat-toolbar>

        <!-- Main -->
        <main class="main">
          <h1>CrossFit Competition App 🏋️</h1>

          <ng-container *ngIf="(auth.appUser$ | async) as user; else loggedOut">
            <p>Hola, {{ user.displayName || user.email }} (rol: {{ user.role }})</p>
            <div class="actions">
              <a mat-raised-button color="primary" routerLink="/dashboard">Dashboard</a>
              <a mat-raised-button color="primary" routerLink="/leaderboard">Tablero de resultados</a>
              <a mat-raised-button color="accent" routerLink="/my-team">Ver / Unirme a un equipo</a>

              <a *ngIf="user.role === 'admin'" mat-raised-button color="warn" routerLink="/admin">
                Panel Admin
              </a>

              <a *ngIf="user.role === 'admin' || user.role === 'judge'"
                 mat-raised-button color="accent" routerLink="/judge">
                Panel de Juez
              </a>

              <button mat-raised-button (click)="logout()">Salir</button>
            </div>
          </ng-container>

          <ng-template #loggedOut>
            <div class="actions">
              <a mat-raised-button color="primary" routerLink="/auth/login">Entrar</a>
              <a mat-raised-button routerLink="/auth/register">Crear cuenta</a>
            </div>
          </ng-template>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .layout-container { height: 100dvh; background: #fff; }
    .side { width: 280px; border-right: 1px solid #eee; display:flex; flex-direction:column; }
    .side-header { display:flex; align-items:center; gap:10px; padding:16px 14px; }
    .brand { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color:#fff; font-weight:800;
             background:#FC5500; }
    .brand-txt span { color:#6b7280; font-size:.85rem; }
    .side-footer { margin-top:auto; padding:12px 14px; border-top:1px solid #eee; }
    .user { display:flex; gap:10px; align-items:center; color:#1d1d1f; }
    .user .meta .name { font-weight:600; }
    .user .meta .role { font-size:.85rem; color:#6b7280; }

    .app-toolbar { position: sticky; top: 0; z-index: 3; }
    .toolbar-title { display:flex; align-items:center; gap:10px; }
    .logo { background:#fff; color:#FC5500; border-radius:8px; padding:4px 8px; font-weight:800; }
    .title { font-weight:700; }
    .spacer { flex:1; }
    .only-handset { display:none; }
    .hide-handset { display:flex; gap:4px; }

    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding: 16px; display:grid; gap:12px; }
    h1 { margin:0; font-size:1.6rem; }
    .actions { display:flex; flex-wrap:wrap; gap:12px; }

    /* Mobile-first: en pantallas pequeñas mostramos botón de menú y ocultamos acciones de toolbar */
    @media (max-width: 959px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }
    }

    /* Link activo del sidenav */
    .active { background: rgba(252,85,0,0.08); }
  `],
})
export class HomeComponent {
  auth = inject(AuthService);
  private bpo = inject(BreakpointObserver);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  logout() { this.auth.logout(); }

  closeOnMobile(drawer: { close: () => void }) {
    // Si está en modo 'over' (handset), cerramos al navegar
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }
}
