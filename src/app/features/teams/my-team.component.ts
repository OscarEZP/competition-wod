// src/app/features/my-team/my-team.component.ts
import { Component, inject, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { switchMap, map, of, shareReplay, firstValueFrom } from 'rxjs';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Category, Team } from '../../../core/models/team';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { AppSideMenuComponent } from '../../shared/ui/app-side-menu.component';
import { AppHeaderComponent } from '../../shared/ui/app-header.component';

// ⬇️ Usa los mismos paths que dejaste en Home

@Component({
  standalone: true,
  selector: 'app-my-team',
  imports: [
    CommonModule,
    MatToolbarModule, MatSidenavModule, MatIconModule, MatDividerModule, MatListModule,
    MatButtonModule, MatSelectModule, MatFormFieldModule, MatInputModule,
    ReactiveFormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule, MatTooltipModule, MatDialogModule,
    AppHeaderComponent, AppSideMenuComponent
  ],
  template: `
    <mat-sidenav-container class="layout-container">
      <!-- Sidebar -->
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

      <!-- Content -->
      <mat-sidenav-content class="content">
        <app-header
          [title]="'Mi equipo'"
          (menu)="drawer.toggle()">
          <!-- Acción a la derecha (desktop) -->
          <button mat-raised-button color="primary" header-actions class="hide-handset"
                  (click)="openCreateDialog(createTpl)">
            <mat-icon>add</mat-icon>
            Crear equipo
          </button>
        </app-header>

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

                  <!-- Botón móvil (ya lo tenías) -->
                  <button mat-stroked-button color="primary" class="only-handset" (click)="openCreateDialog(createTpl)">
                    <mat-icon>add</mat-icon>
                    Crear equipo
                  </button>
                </div>

                <div class="table-wrap" *ngIf="(displayedColumns$ | async) as cols">
                  <table mat-table [dataSource]="dataSource" matSort class="teams-table mat-elevation-z1">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre</th>
                      <td mat-cell *matCellDef="let t">{{ t.name }}</td>
                    </ng-container>

                    <ng-container matColumnDef="category">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Categoría</th>
                      <td mat-cell *matCellDef="let t">{{ t.category }}</td>
                    </ng-container>

                    <ng-container matColumnDef="members">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Miembros</th>
                      <td mat-cell *matCellDef="let t">{{ t.membersIds?.length || 0 }}</td>
                    </ng-container>

                    <ng-container matColumnDef="action">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let t">
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
                    [showFirstLastButtons]="!(isHandset$ | async)">
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

    .content { height:100%; display:flex; flex-direction:column; }
    .main { padding:16px; display:grid; gap:16px; }
    .card { background:#fff; border:1px solid #eee; border-radius:14px; padding:16px; }
    h3 { margin:0 0 8px; color:#FC5500; font-weight:700; }
    .text { color:#333; }
    .text-muted { color:#9e9e9e; }

    .filters { display:grid; grid-template-columns: 1fr; gap:12px; align-items:end; margin-bottom:8px; }
    .filters .search { width:100%; }

    .table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #f0f0f0; }
    table { width:100%; background:#fff; }
    .teams-table thead th { background: rgba(252,85,0,0.06); color:#333; }
    .teams-table tr:hover td { background: rgba(252,85,0,0.04); }
    .teams-table td, .teams-table th { padding: 10px 12px; }

    .only-handset { display:none; }
    .hide-handset { display:flex; gap:8px; }

    @media (max-width: 599px) {
      .only-handset { display:inline-flex; }
      .hide-handset { display:none; }
      .side { width: 88vw; }
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
  dataSource = new MatTableDataSource<Team>([]);

  displayedColumns$ = this.bpo.observe(['(max-width: 599px)'])
    .pipe(map(s => s.matches ? ['name','category','action'] : ['name','category','members','action']), shareReplay(1));

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
    try { await this.teamsSvc.joinTeam(teamId); alert('¡Te uniste al equipo!'); }
    catch (e: any) { alert(e?.message || 'Error al unirse'); }
  }

  async leave(teamId: string) {
    try { await this.teamsSvc.leaveTeam(teamId); alert('Has salido del equipo.'); }
    catch (e: any) { alert(e?.message || 'Error al salir'); }
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
