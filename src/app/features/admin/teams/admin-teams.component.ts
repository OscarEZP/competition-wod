import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { map, shareReplay } from 'rxjs';
import { TeamService } from '../../../../core/services/team.service';
import { Category, Team } from '../../../../core/models/team';
import { AdminUserService } from '../../../../core/services/admin-user.service';
import { AppHeaderComponent } from '../../../shared/ui/app-header.component';
import { AppSideMenuComponent } from '../../../shared/ui/app-side-menu.component';
import { AuthService } from '../../../../core/services/auth.service';

type MemberVM = { id: string; displayName?: string | null; email?: string | null; photoURL?: string | null };

@Component({
  standalone: true,
  selector: 'app-admin-teams',
  imports: [
    CommonModule,
    // Layout shell
    MatToolbarModule, MatSidenavModule, MatIconModule, MatListModule, MatDividerModule,
    AppHeaderComponent, AppSideMenuComponent,
    // UI
    MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatDialogModule, MatChipsModule, MatProgressSpinnerModule, MatCardModule,
    ReactiveFormsModule, FormsModule,
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
          <!-- Crear equipo -->
          <section class="card">
            <form [formGroup]="form" (ngSubmit)="create()" class="grid">
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

              <button mat-raised-button color="primary" class="submit"
                [disabled]="form.invalid || loading">
                {{ loading ? 'Creando...' : 'Crear equipo' }}
              </button>
            </form>
          </section>

          <!-- Listado (mobile-first: cards en móvil, tabla en >= sm) -->
          <section class="card">
            <!-- Cards móviles -->
            <div class="cards" *ngIf="(isHandset$ | async); else tableTpl">
              <mat-card class="team-card" *ngFor="let t of teams">
                <div class="tc-head">
                  <div class="tc-name">{{ t.name }}</div>
                  <div class="tc-badge">{{ t.category }}</div>
                </div>

                <div class="tc-sub">
                  <span class="tc-members">{{ t.membersIds.length }} miembros</span>
                </div>

                <div class="tc-actions">
                  <ng-container *ngIf="editId!==t.id; else editing">
                    <button mat-stroked-button color="primary" (click)="startEdit(t)">Editar</button>
                    <button mat-stroked-button color="primary" (click)="openMembersDialog(t, membersTpl)">Integrantes</button>
                    <button mat-stroked-button color="warn" (click)="remove(t)">Eliminar</button>
                  </ng-container>
                  <ng-template #editing>
                    <div class="edit-grid">
                      <mat-form-field appearance="outline" class="w">
                        <mat-label>Nombre</mat-label>
                        <input matInput [(ngModel)]="editName" name="editName-{{t.id}}"/>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="w">
                        <mat-label>Categoría</mat-label>
                        <mat-select [(ngModel)]="editCategory" name="editCat-{{t.id}}">
                          <mat-option value="RX">RX</mat-option>
                          <mat-option value="Intermedio">Intermedio</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <div class="edit-actions">
                        <button mat-raised-button color="primary" (click)="saveEdit(t)">Guardar</button>
                        <button mat-button (click)="cancelEdit()">Cancelar</button>
                      </div>
                    </div>
                  </ng-template>
                </div>
              </mat-card>
            </div>

            <!-- Tabla para pantallas medianas y grandes -->
            <ng-template #tableTpl>
              <div class="table-wrap">
                <table mat-table [dataSource]="teams" class="teams-table mat-elevation-z1">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Equipo</th>
                    <td mat-cell *matCellDef="let t">
                      <input *ngIf="editId===t.id; else viewName" matInput [(ngModel)]="editName"/>
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
                    <td mat-cell *matCellDef="let t">
                      {{ t.membersIds.length }}
                      <button mat-stroked-button color="primary" class="ml8" (click)="openMembersDialog(t, membersTpl)">
                        Ver integrantes
                      </button>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Acciones</th>
                    <td mat-cell *matCellDef="let t" class="actions">
                      <button *ngIf="editId!==t.id" mat-stroked-button color="primary" (click)="startEdit(t)">Editar</button>
                      <button *ngIf="editId===t.id" mat-raised-button color="primary" (click)="saveEdit(t)">Guardar</button>
                      <button *ngIf="editId===t.id" mat-button (click)="cancelEdit()">Cancelar</button>
                      <button mat-stroked-button color="warn" (click)="remove(t)">Eliminar</button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="cols"></tr>
                  <tr mat-row *matRowDef="let row; columns: cols;"></tr>
                </table>
              </div>
            </ng-template>
          </section>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>

    <!-- Diálogo integrantes -->
    <ng-template #membersTpl>
      <h2 mat-dialog-title style="margin:0;">Integrantes — {{ membersTeam?.name }}</h2>
      <div mat-dialog-content class="dialog-content">
        <div *ngIf="membersLoading" class="loading">
          <mat-progress-spinner mode="indeterminate" diameter="36"></mat-progress-spinner>
        </div>

        <div *ngIf="!membersLoading && (!members?.length)">
          <p class="muted">Este equipo no tiene integrantes aún.</p>
        </div>

        <mat-list *ngIf="!membersLoading && members?.length">
          <mat-list-item *ngFor="let m of members">
            <img matListItemIcon *ngIf="m.photoURL; else personIcon" [src]="m.photoURL" alt="" width="24" height="24" style="border-radius:50%; object-fit:cover;" />
            <ng-template #personIcon>
              <mat-icon matListItemIcon>person</mat-icon>
            </ng-template>
            <div matListItemTitle>{{ m.displayName || '—' }}</div>
            <div matListItemLine class="mono">{{ m.email || m.id }}</div>
          </mat-list-item>
        </mat-list>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cerrar</button>
      </div>
    </ng-template>
  `,
  styles: [`
    /* ===== Shell ===== */
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

    /* ===== Form (mobile-first) ===== */
    .grid { display:grid; grid-template-columns: 1fr; gap:12px; align-items:end; width:100%; }
    .w { width:100%; min-width:0; }
    .submit { justify-self: stretch; }

    @media (min-width: 600px) {
      .grid { grid-template-columns: 1fr 220px auto; }
      .submit { justify-self: start; }
    }

    /* ===== Cards móviles ===== */
    .cards { display:grid; gap:12px; }
    .team-card { border:1px solid #f0f0f0; border-radius:16px; }
    .tc-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .tc-name { font-weight:800; font-size:1.05rem; }
    .tc-badge { padding:4px 10px; border-radius:999px; background: rgba(252,85,0,.08); color:#FC5500; font-weight:700; }
    .tc-sub { margin-top:6px; color:#6b7280; font-size:.95rem; }
    .tc-actions { margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; }
    .edit-grid { display:grid; grid-template-columns: 1fr; gap:8px; width:100%; }
    .edit-actions { display:flex; gap:8px; flex-wrap:wrap; }

    /* ===== Tabla (>= sm) ===== */
    .table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #f0f0f0; width:100%; }
    table { width:100%; background:#fff; }
    .teams-table thead th { background: rgba(252,85,0,0.06); color:#333; font-weight:700; }
    .teams-table td, .teams-table th { padding: 12px 14px; white-space: nowrap; }
    .teams-table tr:hover td { background: rgba(252,85,0,0.04); }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .ml8 { margin-left: 8px; }

    /* ===== Diálogo ===== */
    .dialog-content { min-width: min(92vw, 520px); max-width: 92vw; }
    .loading { display:grid; place-items:center; padding:16px; }
    .muted { color:#9e9e9e; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

    /* ===== Mobile tweaks ===== */
    @media (max-width: 599px) {
      .only-handset { display:inline-flex; }
      .side { width: 88vw; }
      .card { padding:12px; border-radius:14px; }
      .table-wrap { display:none; }
      .tc-actions button { flex: 1 1 calc(50% - 8px); }
    }

    /* ===== FIXES ===== */
    :host, .layout-container, .content, .main, .card { max-width: 100%; }
    :host { display:block; }
    html, body { overflow-x: hidden; }
    .mat-sidenav-content { overflow-x: clip; }
    *, *::before, *::after { box-sizing: border-box; }
  `]
})
export class AdminTeamsComponent {
  private fb = inject(FormBuilder);
  private teamsSvc = inject(TeamService);
  private bpo = inject(BreakpointObserver);
  private dialog = inject(MatDialog);
  private adminUsers = inject(AdminUserService);
  auth = inject(AuthService);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  loading = false;
  teams: Team[] = [];
  cols = ['name', 'category', 'members', 'actions'];

  editId: string | null = null;
  editName = '';
  editCategory: Category = 'RX';

  // Diálogo integrantes
  @ViewChild('membersTpl') membersTpl!: TemplateRef<unknown>;
  membersTeam: Team | null = null;
  membersLoading = false;
  members: MemberVM[] = [];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['RX' as Category, [Validators.required]],
  });

  constructor() {
    this.teamsSvc.listAll$().subscribe(ts => this.teams = ts);
  }

  /* ===== CRUD equipos ===== */
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
  cancelEdit() { this.editId = null; }

  async saveEdit(t: Team) {
    if (!this.editId) return;
    await this.teamsSvc.update(t.id, { name: this.editName, category: this.editCategory });
    this.editId = null;
  }

  async remove(t: Team) {
    if (!confirm(`Eliminar equipo "${t.name}"?`)) return;
    await this.teamsSvc.remove(t.id);
  }

  /* ===== Integrantes ===== */
  openMembersDialog(t: Team, tpl: TemplateRef<unknown>) {
    this.membersTeam = t;
    this.members = [];
    this.membersLoading = true;

    // Abre el diálogo primero; cargamos dentro
    this.dialog.open(tpl, {
      width: 'min(92vw, 560px)',
      maxWidth: '92vw',
      autoFocus: false,
    });

    const ids = (t.membersIds || []).filter(Boolean);
    if (!ids.length) {
      this.membersLoading = false;
      return;
    }

    // Carga desde colección users por IDs (usa chunk de 10 en el servicio)
    this.adminUsers.getUsersByIds(ids)
      .then(users => {
        this.members = users.map(u => ({
          id: u.uid,
          displayName: u.displayName ?? '—',
          email: u.email ?? null,
        }));
      })
      .catch(err => {
        console.error('[admin-teams] error cargando miembros', err);
        // Fallback mínimo por si falla: mostrar solo IDs
        this.members = ids.map(id => ({ id }));
      })
      .finally(() => {
        this.membersLoading = false;
      });
  }

  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }

  logout() { this.auth.logout(); }
}
