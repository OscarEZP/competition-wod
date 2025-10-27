// src/app/shared/ui/app-header.component.ts
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar class="app-toolbar" color="primary">
      <button
        type="button"
        mat-icon-button
        aria-label="Abrir menú"
        (click)="menu.emit()"
        class="only-handset"
      >
        <mat-icon>menu</mat-icon>
      </button>

      <div class="toolbar-title">
        <span class="logo">CF</span>
        <span class="title">{{ title }}</span>
      </div>

      <span class="spacer"></span>

      <div class="toolbar-actions hide-handset">
        <a mat-button routerLink="/dashboard">Dashboard</a>
        <a mat-button routerLink="/leaderboard">Tablero</a>
        <a mat-button routerLink="/my-team">Mi equipo</a>
      </div>
    </mat-toolbar>
  `,
  styles: [`
    .app-toolbar { position: sticky; top: 0; z-index: 3; color:#fff; }
    .toolbar-title { display:flex; align-items:center; gap:10px; }
    .logo { background:#fff; color:#FC5500; border-radius:8px; padding:4px 8px; font-weight:800; }
    .title { font-weight:700; }
    .spacer { flex:1; }
    .only-handset { display:none; }
    .hide-handset { display:flex; gap:4px; }
    @media (max-width: 959px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }
    }
  `]
})
export class AppHeaderComponent {
  @Input() title = 'Dashboard';
  @Output() menu = new EventEmitter<void>();
}
