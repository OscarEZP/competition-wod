import { Component, inject, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { switchMap, map, of, shareReplay, firstValueFrom } from 'rxjs';
import { Category, Team } from '../../../core/models/team';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';

import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  standalone: true,
  selector: 'app-my-team',
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatIconModule, MatDividerModule, MatListModule,
    ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatTableModule, MatPaginatorModule, MatSortModule, MatTooltipModule,
    MatDialogModule,
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <!-- Sidebar -->
      <mat-sidenav #drawer class="side"
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="!(isHandset$ | async)">
        <div class="side-header">
          <div class="brand">CF</div>
          <div class="brand-txt">
            <strong>CrossFit</strong>
            <span>Competition</span>
          </div>
        </div>

        <ng-container *ngIf="(auth.appUser$ | async) as user; else guestMenu">
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            <a mat-list-item routerLink="/leaderboard" routerLinkActive="active" (click)="closeOnMobile(drawer)">
              <mat-icon matListItemIcon>leaderboard</mat-icon>
              <span matListItemTitle>Resultados</span>
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

      <!-- Content -->
      <mat-sidenav-content class="content">
        <mat-toolbar class="app-toolbar" color="primary">
          <button mat-icon-button (click)="drawer.toggle()" class="only-handset" aria-label="Abrir menú">
            <mat-icon>menu</mat-icon>
          </button>
          <div class="toolbar-title">
            <span class="logo">CF</span>
            <span class="title">Mi equipo</span>
          </div>
          <span class="spacer"></span>

          <button mat-raised-button color="primary" class="hide-handset" (click)="openCreateDialog(createTpl)">
            <mat-icon>add</mat-icon>
            Crear equipo
          </button>
        </mat-toolbar>

        <main class="main">
          <ng-container *ngIf="(auth.appUser$ | async) as user">
            <ng-container *ngIf="user.teamId as tid; else noTeam">
              <section class="card">
                <h3>Equipo actual</h3>
                <p class="text"><strong>{{ (teamName$ | async) || 'Cargando…' }}</strong></p>
                <button mat-raised-button color="warn" (click)="leave(tid)">Salir del equipo</button>
              </section>
            </ng-container>

            <ng-template #noTeam>
              <section class="card">
                <h3>Unirme a un equipo existente</h3>

                <div class="filters">
                  <mat-form-field appearance="outline">
                    <mat-label>Categoría</mat-label>
                    <mat-select [(value)]="joinCategory" (valueChange)="loadByCategory()">
                      <mat-option value="RX">RX</mat-option>
                      <mat-option value="Intermedio">Intermedio</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
                    <mat-label>Buscar equipo</mat-label>
                    <input matInput (input)="applyFilter($event)" placeholder="Nombre o categoría" />
                  </mat-form-field>

                  <button mat-stroked-button color="primary" class="only-handset" (click)="openCreateDialog(createTpl)">
                    <mat-icon>add</mat-icon>
                    Crear equipo
                  </button>
                </div>

                <!-- Responsive DataTable -->
                <div class="table-wrap" *ngIf="(displayedColumns$ | async) as cols">
                  <table mat-table [dataSource]="dataSource" matSort class="teams-table mat-elevation-z1">

                    <!-- Nombre -->
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre</th>
                      <td mat-cell *matCellDef="let t">{{ t.name }}</td>
                    </ng-container>

                    <!-- Categoría -->
                    <ng-container matColumnDef="category">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Categoría</th>
                      <td mat-cell *matCellDef="let t">{{ t.category }}</td>
                    </ng-container>

                    <!-- Miembros (se oculta en móvil) -->
                    <ng-container matColumnDef="members">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Miembros</th>
                      <td mat-cell *matCellDef="let t">{{ t.membersIds?.length || 0 }}</td>
                    </ng-container>

                    <!-- Acción -->
                    <ng-container matColumnDef="action">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let t">
                        <!-- Desktop: botón con texto | Móvil: icon-button -->
                        <ng-container *ngIf="!(isHandset$ | async); else mobileJoin">
                          <button mat-stroked-button color="primary" (click)="join(t.id)" matTooltip="Unirme a {{t.name}}">
                            Unirme
                          </button>
                        </ng-container>
                        <ng-template #mobileJoin>
                          <button mat-icon-button color="primary" (click)="join(t.id)" aria-label="Unirme">
                            <mat-icon>person_add</mat-icon>
                          </button>
                        </ng-template>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="cols"></tr>
                    <tr mat-row *matRowDef="let row; columns: cols;"></tr>
                  </table>

                  <mat-paginator
                    [pageSize]="10"
                    [pageSizeOptions]="(isHandset$ | async) ? [5,10] : [5,10,25]"
                    [hidePageSize]="(isHandset$ | async) ? true : false"
                    [showFirstLastButtons]="!(isHandset$ | async)"
                    aria-label="Paginador">
                  </mat-paginator>
                </div>

                <p *ngIf="!dataSource?.data?.length" class="text-muted">
                  No hay equipos en {{ joinCategory }} aún.
                </p>
              </section>
            </ng-template>
          </ng-container>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>

    <!-- Diálogo de Crear equipo -->
    <ng-template #createTpl>
      <h2 mat-dialog-title style="margin:0;">Crear equipo</h2>
      <div mat-dialog-content class="dialog-content">
        <form [formGroup]="form" (ngSubmit)="create()" class="form-col">
          <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
            <mat-label>Nombre del equipo</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
            <mat-label>Categoría</mat-label>
            <mat-select formControlName="category">
              <mat-option value="RX">RX</mat-option>
              <mat-option value="Intermedio">Intermedio</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="dialog-actions">
            <button mat-button mat-dialog-close type="button">Cancelar</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
              {{ loading ? 'Creando…' : 'Crear y unirme' }}
            </button>
          </div>
        </form>
      </div>
    </ng-template>
  `,
  styles: [`
    /* Layout coherente con Home */
    .layout-container { height: 100dvh; background:#fff; }
    .side { width: 270px; border-right:1px solid #f1f1f1; display:flex; flex-direction:column; background:#fff; }
    .side-header { display:flex; align-items:center; gap:10px; padding:16px 14px; }
    .brand { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color:#fff; font-weight:800; background:#FC5500; }
    .brand-txt span { color:#9e9e9e; font-size:.85rem; }
    .side-footer { margin-top:auto; padding:12px 14px; border-top:1px solid #f0f0f0; }
    .user { display:flex; gap:10px; align-items:center; color:#FC5500; }
    .user .meta .name { font-weight:600; color:#333; }
    .user .meta .role { font-size:.85rem; color:#9e9e9e; }

    .app-toolbar { position: sticky; top: 0; z-index: 3; color:#fff; }
    .toolbar-title { display:flex; align-items:center; gap:10px; }
    .logo { background:#fff; color:#FC5500; border-radius:8px; padding:4px 8px; font-weight:800; }
    .title { font-weight:700; color:#fff; }
    .spacer { flex: 1; }

    .only-handset { display:none; }
    .hide-handset { display:flex; gap:8px; }

    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding:16px; display:grid; gap:16px; }
    .card { background:#fff; border:1px solid #eee; border-radius:14px; padding:16px; }
    h3 { margin:0 0 8px; color:#FC5500; font-weight:700; }
    .text { color:#333; }
    .text-muted { color:#9e9e9e; }

    .filters { display:grid; grid-template-columns: 1fr; gap:12px; align-items:end; margin-bottom:8px; }
    .filters .search { width:100%; }

    /* Tabla responsive */
    .table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #f0f0f0; }
    table { width:100%; background:#fff; }
    .teams-table thead th { background: rgba(252,85,0,0.06); color:#333; }
    .teams-table tr:hover td { background: rgba(252,85,0,0.04); }
    .teams-table td, .teams-table th { padding: 10px 12px; }
    .active { background: rgba(252,85,0,0.08); }

    /* Compactación mobile-first */
    @media (max-width: 599px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }

      .side { width: 88vw; } /* sidenav casi full en móvil */
      .app-toolbar { padding: 0 8px; }
      .teams-table td, .teams-table th { padding: 8px 10px; }
      .card { padding:12px; }
      .filters { grid-template-columns: 1fr; }
    }

    @media (min-width: 600px) {
      .filters { grid-template-columns: 200px 1fr auto; }
    }
  `],
})
export class MyTeamComponent implements AfterViewInit {
  teamsSvc = inject(TeamService);
  auth = inject(AuthService);
  fb = inject(FormBuilder);
  private bpo = inject(BreakpointObserver);
  private dialog = inject(MatDialog);

  loading = false;
  joinCategory: Category = 'RX';
  teamsToJoin: Team[] = [];

  /** Columnas dinámicas: en móvil ocultamos "members" para evitar overflow */
  displayedColumns$ = this.bpo.observe(['(max-width: 599px)'])
    .pipe(
      map(state => state.matches ? ['name','category','action'] : ['name','category','members','action']),
      shareReplay(1)
    );

  dataSource = new MatTableDataSource<Team>([]);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  teamName$ = this.auth.appUser$.pipe(
    switchMap(u => u?.teamId ? this.teamsSvc.getById$(u.teamId) : of(null)),
    map(t => t?.name || null)
  );

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['RX' as Category, [Validators.required]],
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('createTpl') createTpl!: TemplateRef<unknown>;

  constructor() { this.loadByCategory(); }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadByCategory() {
    this.teamsSvc.listByCategory$(this.joinCategory).subscribe(ts => {
      this.teamsToJoin = ts;
      this.dataSource.data = ts || [];
      if (this.paginator) this.paginator.firstPage();
    });
  }

  applyFilter(event: Event) {
    const val = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = val.trim().toLowerCase();
    if (this.paginator) this.paginator.firstPage();
  }

  async openCreateDialog(tpl: TemplateRef<unknown>) {
    this.form.reset({ name: '', category: 'RX' });
    const isMobile = await firstValueFrom(this.bpo.observe(['(max-width: 599px)']).pipe(map(r => r.matches)));
    this.dialog.open(tpl, {
      width: isMobile ? '100vw' : '420px',
      maxWidth: isMobile ? '100vw' : '92vw',
      height: isMobile ? '100dvh' : undefined,
      panelClass: isMobile ? 'full-screen-dialog' : undefined,
      autoFocus: true,
    });
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
      this.dialog.closeAll();
      this.loadByCategory();
    } catch (e: any) {
      alert(e?.message || 'Error al crear equipo');
    } finally {
      this.loading = false;
    }
  }

  logout() { this.auth.logout(); }

  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }
}
