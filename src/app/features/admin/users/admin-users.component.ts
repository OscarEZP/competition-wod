import { Component, inject, TemplateRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

// ===== Shell / Layout (igual que admin-teams)
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

// ===== UI base
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// ===== DataTable + Filtro + Sort + Paginador
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { map, shareReplay, Subject, takeUntil } from 'rxjs';
import { AppUser } from '../../../../core/models/app-user';
import { AdminUserService } from '../../../../core/services/admin-user.service';
import { AppHeaderComponent } from '../../../shared/ui/app-header.component';
import { AppSideMenuComponent } from '../../../shared/ui/app-side-menu.component';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-admin-users',
  imports: [
    CommonModule,
    // Shell
    MatToolbarModule, MatSidenavModule, MatIconModule, MatListModule, MatDividerModule,
    AppHeaderComponent, AppSideMenuComponent,

    // UI
    MatCardModule, MatButtonModule, MatDialogModule, MatChipsModule, MatProgressSpinnerModule,
    ReactiveFormsModule, FormsModule,

    // DataTable
    MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatPaginatorModule, MatSortModule, MatTooltipModule, MatSnackBarModule,
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <mat-sidenav #drawer class="side"
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="!(isHandset$ | async)">
        <ng-container *ngIf="(auth.appUser$ | async) as user; else guestMenu">
          <app-side-menu
            [user]="user"
            (logout)="logout()"
            (item)="closeOnMobile(drawer)">
          </app-side-menu>
        </ng-container>
        <ng-template #guestMenu>
          <app-side-menu
            [user]="null"
            (item)="closeOnMobile(drawer)">
          </app-side-menu>
        </ng-template>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <app-header
          [title]="'Panel de Juez'"
          (menu)="drawer.toggle()">
        </app-header>

        <main class="main">
          <!-- Header + Filtro -->
          <section class="card">
            <div class="list-header">
              <div class="lh-left">
                <h3 class="lh-title">Administración de usuarios</h3>
                <p class="lh-subtitle">Asigna o quita el rol <strong>judge</strong>.</p>
              </div>

              <mat-form-field appearance="outline" class="search">
                <mat-label>Buscar (nombre o email)</mat-label>
                <input matInput [(ngModel)]="filterValue" (input)="applyFilter()" placeholder="Filtrar..." />
                <button mat-icon-button matSuffix aria-label="clear" *ngIf="filterValue" (click)="clearFilter()">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-form-field>
            </div>
          </section>

          <!-- Vista mobile: cards -->
          <section class="card" *ngIf="(isHandset$ | async); else desktopTable">
            <div *ngIf="loading" class="loading">
              <mat-progress-spinner mode="indeterminate" diameter="36"></mat-progress-spinner>
            </div>

            <div class="cards" *ngIf="!loading && mobileData.length === 0">
              <p class="muted">No hay usuarios que coincidan con el filtro.</p>
            </div>

            <div class="cards" *ngIf="!loading && mobileData.length > 0">
              <mat-card class="user-card" *ngFor="let u of mobileData; trackBy: trackByUid">
                <div class="uc-head">
                  <div class="uc-identity">
                    <div class="uc-identity-text">
                      <div class="name">{{ u.displayName || '—' }}</div>
                      <div class="uc-email mono ellipsis">{{ u.email || '—' }}</div>
                    </div>
                  </div>
                </div>

                <div class="uc-roles">
                  <ng-container *ngIf="u.role?.length; else baseUser">
                    <span *ngFor="let r of u.role" class="badge">{{ r }}</span>
                  </ng-container>
                  <ng-template #baseUser>
                    <span class="badge">user</span>
                  </ng-template>
                </div>

                <div class="uc-actions">
                  <button mat-stroked-button color="primary" *ngIf="!hasJudge(u)" (click)="onAddJudge(u)" [disabled]="loading">
                    Hacer juez
                  </button>
                  <button mat-stroked-button color="warn" *ngIf="hasJudge(u)" (click)="onRemoveJudge(u)" [disabled]="loading">
                    Quitar juez
                  </button>
                </div>
              </mat-card>
            </div>
          </section>

          <!-- Vista desktop: tabla + paginador -->
          <ng-template #desktopTable>
            <section class="card">
              <div class="table-wrap">
                <table mat-table [dataSource]="dataSource" matSort matSortDisableClear class="users-table mat-elevation-z1">
                  <!-- Nombre -->
                  <ng-container matColumnDef="displayName">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Usuario</th>
                    <td mat-cell *matCellDef="let u">
                      <div class="cell-user">
                        <img *ngIf="u.photoURL" [src]="u.photoURL" width="28" height="28" class="avatar" alt="">
                        <div class="cell-user-info">
                          <div class="name">{{ u.displayName || '—' }}</div>
                          <div class="email mono ellipsis">{{ u.email || '—' }}</div>
                        </div>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Roles -->
                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Roles</th>
                    <td mat-cell *matCellDef="let u">
                      <ng-container *ngIf="u.role?.length; else baseUser2">
                        <span *ngFor="let r of u.role" class="badge mr8">{{ r }}</span>
                      </ng-container>
                      <ng-template #baseUser2><span class="badge">user</span></ng-template>
                    </td>
                  </ng-container>

                  <!-- Acciones -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Acciones</th>
                    <td mat-cell *matCellDef="let u" class="text-right">
                      <button mat-stroked-button color="primary" class="mr8" *ngIf="!hasJudge(u)" (click)="onAddJudge(u)" [disabled]="loading" matTooltip="Asignar rol judge">
                        <mat-icon>gavel</mat-icon>&nbsp;Hacer juez
                      </button>
                      <button mat-stroked-button color="warn" *ngIf="hasJudge(u)" (click)="onRemoveJudge(u)" [disabled]="loading" matTooltip="Quitar rol judge">
                        <mat-icon>remove_circle</mat-icon>&nbsp;Quitar juez
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="cols"></tr>
                  <tr mat-row *matRowDef="let row; columns: cols; trackBy: trackByUid"></tr>
                </table>
              </div>

              <mat-paginator [length]="total" [pageSize]="10" [pageSizeOptions]="[5,10,25,50]" showFirstLastButtons></mat-paginator>
            </section>
          </ng-template>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    /* ===== Shell (idéntico a admin-teams) ===== */
    .layout-container { height: 100dvh; background:#fff; }
    .side { width: 270px; border-right:1px solid #f1f1f1; display:flex; flex-direction:column; background:#fff; }
    .side-header { display:flex; align-items:center; gap:10px; padding:16px 14px; }
    .brand { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color:#fff; font-weight:800; background:#FC5500; }
    .brand-txt span { color:#9e9e9e; font-size:.85rem; }
    .active { background: rgba(252,85,0,0.08); }

    .app-toolbar { position: sticky; top: 0; z-index: 3; color:#fff; }
    .toolbar-title { display:flex; align-items:center; gap:10px; }
    .logo { background:#fff; color:#FC5500; border-radius:8px; padding:4px 8px; font-weight:800; }
    .title { font-weight:700; color:#fff; }
    .spacer { flex:1; }
    .only-handset { display:none; }

    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding:16px; display:grid; gap:16px; width:100%; max-width: 1400px; margin-inline:auto; }
    .card { background:#fff; border:1px solid #eee; border-radius:16px; padding:16px; width:100%; }

    /* ===== Header + Filtro ===== */
    .list-header { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .lh-title { margin:0; font-weight:800; }
    .lh-subtitle { margin:.25rem 0 0 0; color:#6b7280; }
    .search { width: 320px; max-width: 100%; }

    /* ===== Mobile cards (mejoradas) ===== */
    .cards { display:grid; gap:12px; }
    .user-card {
      border:1px solid #f0f0f0;
      border-radius:16px;
      padding:14px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }

    .uc-head { display:flex; justify-content:space-between; align-items:center; }
    .uc-identity { display:flex; align-items:center; gap:12px; }
    .avatar { border-radius:50%; object-fit:cover; }
    .uc-identity-text { display:flex; flex-direction:column; gap:2px; }
    .name { font-weight:800; font-size:1.05rem; line-height: 1.1; }
    .uc-email { color:#6b7280; font-size:.9rem; }
    .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 68vw; }

    .uc-roles {
      margin-top:10px;
      display:flex; gap:8px; flex-wrap:wrap;
    }
    .badge {
      padding:4px 10px;
      border-radius:999px;
      background: rgba(252,85,0,.08);
      color:#FC5500;
      font-weight:700;
      font-size:.85rem;
    }

    .uc-actions {
      margin-top:12px;
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:8px;
    }
    .uc-actions button { width: 100%; }

    /* ===== Tabla ===== */
    .table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #f0f0f0; width:100%; }
    table { width:100%; background:#fff; }
    .users-table thead th { background: rgba(252,85,0,0.06); color:#333; font-weight:700; }
    .users-table td, .users-table th { padding: 12px 14px; white-space: nowrap; }
    .users-table tr:hover td { background: rgba(252,85,0,0.04); }
    .cell-user { display:flex; align-items:center; gap:10px; }
    .cell-user-info .name { font-weight:700; }
    .cell-user-info .email { color:#6b7280; }
    .text-right { text-align:right; }
    .mr8 { margin-right: 8px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

    /* ===== Estados ===== */
    .loading { display:grid; place-items:center; padding:16px; }
    .muted { color:#9e9e9e; }

    /* ===== Mobile tweaks & overflow fixes (idénticos) ===== */
    :host, .layout-container, .content, .main, .card { max-width: 100%; }
    :host { display:block; }
    html, body { overflow-x: hidden; }
    .mat-sidenav-content { overflow-x: clip; }

    .table-wrap { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .users-table { width: 100%; max-width: 100%; table-layout: auto; }

    .side { width: clamp(240px, 72vw, 270px); }
    @media (max-width: 599px) {
      .only-handset { display:inline-flex; }
      .side { width: 86vw; }
      .main { padding: 12px; }
      .card { padding: 12px; border-radius: 14px; }
      .table-wrap { display: none; } /* usamos cards en móvil */
      /* ya usamos grid 2-col para botones, no hace falta flex tweak */
    }

    *, *::before, *::after { box-sizing: border-box; }
  `]
})
export class AdminUsersComponent implements AfterViewInit, OnDestroy {
  private bpo = inject(BreakpointObserver);
  private adminSrv = inject(AdminUserService);
  private snack = inject(MatSnackBar);
  auth = inject(AuthService);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  // DataTable
  dataSource = new MatTableDataSource<AppUser>([]);
  cols: string[] = ['displayName', 'roles', 'actions'];
  total = 0;

  loading = false;
  filterValue = '';

  // Mobile data render (post-filtro)
  mobileData: AppUser[] = [];

  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor() {
    this.loading = true;

    this.adminSrv.listUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          const mapped = (users || []).map(u => ({
              uid: u.uid,
              displayName: u.displayName || '—',
              photoURL: u.photoURL || null,
              email: u.email || null,
              roles: Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles as any] : []),
              createdAt: (u as any).createdAt ?? null,
          })) as unknown as AppUser[];

          this.dataSource.data = mapped;
          this.total = mapped.length;
          this.applyFilter(); // sincroniza mobileData
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          console.error('[admin-users] listUsers error', err);
          this.snack.open('Error cargando usuarios', 'Cerrar', { duration: 3000 });
        }
      });

    // Filtro por nombre/email/roles
    this.dataSource.filterPredicate = (data: AppUser, filter: string) => {
      const f = (filter || '').trim().toLowerCase();
      if (!f) return true;
      const name = (data.displayName || '').toLowerCase();
      const mail = (data.email || '').toLowerCase();
      const role = (data.role || []).toLowerCase();
      return name.includes(f) || mail.includes(f) || role.includes(f);
    };
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    if (this.sort) this.sort.sort({ id: 'displayName', start: 'asc', disableClear: false });
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByUid = (_: number, u: AppUser) => u.uid;

  applyFilter() {
    this.dataSource.filter = (this.filterValue || '').trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    const filtered = this.dataSource.filteredData.length ? this.dataSource.filteredData : this.dataSource.data;
    this.mobileData = [...filtered];
    this.total = filtered.length || this.dataSource.data.length;
  }

  clearFilter() {
    this.filterValue = '';
    this.applyFilter();
  }

  hasJudge(u: AppUser): boolean {
    return (u.role || []).includes('judge');
  }

  async onAddJudge(u: AppUser) {
    try {
      this.loading = true;
      await this.adminSrv.addJudge(u.uid);
      this.snack.open(`Ahora ${u.displayName || 'el usuario'} es juez`, 'Ok', { duration: 1800 });
    } catch (e) {
      console.error(e);
      this.snack.open('No se pudo asignar juez', 'Cerrar', { duration: 2500 });
    } finally {
      this.loading = false;
    }
  }

  async onRemoveJudge(u: AppUser) {
    try {
      this.loading = true;
      await this.adminSrv.removeJudge(u.uid);
      this.snack.open(`Quitado rol de juez a ${u.displayName || 'usuario'}`, 'Ok', { duration: 1800 });
    } catch (e) {
      console.error(e);
      this.snack.open('No se pudo quitar juez', 'Cerrar', { duration: 2500 });
    } finally {
      this.loading = false;
    }
  }

  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }

  logout() { this.auth.logout(); }

}
