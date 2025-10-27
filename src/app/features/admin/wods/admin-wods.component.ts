import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup, FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { map, shareReplay } from 'rxjs';

import { Category } from '../../../../core/models/team';
import { Wod, WodType, ScoringMode } from '../../../../core/models/wod';
import { WodService } from '../../../../core/services/wod.service';
import { AppHeaderComponent } from '../../../shared/ui/app-header.component';
import { AppSideMenuComponent } from '../../../shared/ui/app-side-menu.component';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-admin-wods',
  imports: [
    CommonModule,
    // Shell
    MatToolbarModule, MatSidenavModule, MatIconModule, MatListModule, MatDividerModule,
    AppHeaderComponent, AppSideMenuComponent,
    // UI
    ReactiveFormsModule, FormsModule,
    MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule
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
          [title]="'Panel de Juez'"
          (menu)="drawer.toggle()">
        </app-header>


        <main class="main">
          <!-- Formulario (mobile-first, full width) -->
          <section class="card">
            <!-- Abrimos UN SOLO form y mantenemos DENTRO el editor de bloques -->
            <form [formGroup]="form" (ngSubmit)="create()" class="grid">
              <mat-form-field appearance="outline" class="w">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="w">
                <mat-label>Categoría</mat-label>
                <mat-select formControlName="category">
                  <mat-option value="RX">RX</mat-option>
                  <mat-option value="Intermedio">Intermedio</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="w">
                <mat-label>Scoring principal</mat-label>
                <mat-select formControlName="scoringMode">
                  <mat-option value="time">Time</mat-option>
                  <mat-option value="reps">Reps</mat-option>
                  <mat-option value="load">Load</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="col-2 w">
                <mat-label>Descripción</mat-label>
                <textarea matInput rows="2" formControlName="description"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="w">
                <mat-label>Unidad predeterminada</mat-label>
                <mat-select formControlName="movementUnit">
                  <mat-option value="kg">kg</mat-option>
                  <mat-option value="lb">lb</mat-option>
                  <mat-option value="reps">reps</mat-option>
                </mat-select>
              </mat-form-field>

              <!-- ======= Editor de bloques (DENTRO del form) ======= -->
              <section class="blocks col-2 w">
                <h3>Bloques del WOD</h3>

                <div class="block-add">
                  <mat-form-field appearance="outline" class="w">
                    <mat-label>Tipo de bloque</mat-label>
                    <mat-select [formControl]="newBlockTypeCtrl">
                      <mat-option value="amrap">AMRAP</mat-option>
                      <mat-option value="for_time">FOR TIME</mat-option>
                      <mat-option value="emom">EMOM</mat-option>
                      <mat-option value="interval">INTERVAL / ON-OFF</mat-option>
                      <mat-option value="for_load">LIFT / LOAD</mat-option>
                      <mat-option value="chipper">CHIPPER</mat-option>
                      <mat-option value="tabata">TABATA</mat-option>
                      <mat-option value="benchmark">BENCHMARK / HERO</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <button mat-stroked-button color="primary" class="add-btn" (click)="addBlock()" type="button">
                    Añadir bloque
                  </button>
                </div>

                <div formArrayName="blocks" class="block-list" *ngIf="blocks.controls.length">
                  <div class="block" *ngFor="let blk of blocks.controls; let i = index" [formGroupName]="i">
                    <div class="block-head">
                      <strong>{{ blocks.at(i).value.type | uppercase }}</strong>
                      <span class="spacer"></span>
                      <button mat-icon-button (click)="moveBlock(i, -1)" [disabled]="i===0" type="button" aria-label="Subir bloque">
                        <mat-icon>arrow_upward</mat-icon>
                      </button>
                      <button mat-icon-button (click)="moveBlock(i, 1)" [disabled]="i===blocks.length-1" type="button" aria-label="Bajar bloque">
                        <mat-icon>arrow_downward</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="removeBlock(i)" type="button" aria-label="Eliminar bloque">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>

                    <!-- Campos específicos por tipo -->
                    <ng-container [ngSwitch]="blocks.at(i).value.type">

                      <!-- AMRAP -->
                      <ng-container *ngSwitchCase="'amrap'">
                        <div class="row-auto">
                          <mat-form-field appearance="outline" class="w">
                            <mat-label>Duración (min)</mat-label>
                            <input matInput type="number" formControlName="minutes" />
                          </mat-form-field>
                        </div>

                        <div class="movements">
                          <h4>Movimientos</h4>
                          <div formArrayName="movements">
                            <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button" aria-label="Eliminar movimiento">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                        </div>
                      </ng-container>

                      <!-- FOR TIME (Cap en MINUTOS) -->
                      <ng-container *ngSwitchCase="'for_time'">
                        <div class="row-auto">
                          <mat-form-field appearance="outline" class="w">
                            <mat-label>Cap (minutos)</mat-label>
                            <input matInput type="number" formControlName="capMinutes" />
                          </mat-form-field>
                        </div>
                        <div class="movements">
                          <h4>Trabajo a completar</h4>
                          <div formArrayName="movements">
                            <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button" aria-label="Eliminar movimiento">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                        </div>
                      </ng-container>

                      <!-- EMOM -->
                      <ng-container *ngSwitchCase="'emom'">
                        <div class="row-auto">
                          <mat-form-field appearance="outline" class="w">
                            <mat-label>Duración (min)</mat-label>
                            <input matInput type="number" formControlName="minutes" />
                          </mat-form-field>
                        </div>
                        <div class="movements">
                          <h4>Por minuto</h4>
                          <div formArrayName="perMinute">
                            <ng-container *ngFor="let m of perMinute(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removePerMinute(i, j)" type="button" aria-label="Eliminar por-minuto">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addPerMinute(i)" type="button">Añadir por-minuto</button>
                        </div>
                      </ng-container>

                      <!-- INTERVAL (Trabajo/Descanso en MINUTOS) -->
                      <ng-container *ngSwitchCase="'interval'">
                        <div class="row-3">
                          <mat-form-field class="w">
                            <mat-label>Trabajo (min)</mat-label>
                            <input matInput type="number" formControlName="workMinutes"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Descanso (min)</mat-label>
                            <input matInput type="number" formControlName="restMinutes"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Rondas</mat-label>
                            <input matInput type="number" formControlName="rounds"/>
                          </mat-form-field>
                        </div>
                        <div class="movements">
                          <h4>Movimientos por intervalo</h4>
                          <div formArrayName="movements">
                            <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button" aria-label="Eliminar movimiento">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                        </div>
                      </ng-container>

                      <!-- FOR LOAD -->
                      <ng-container *ngSwitchCase="'for_load'">
                        <div class="row-4">
                          <mat-form-field class="w">
                            <mat-label>Levantamiento</mat-label>
                            <input matInput formControlName="liftType"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Intentos</mat-label>
                            <input matInput type="number" formControlName="attempts"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Peso mínimo (kg)</mat-label>
                            <input matInput type="number" formControlName="minLoadKg"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Incremento (kg)</mat-label>
                            <input matInput type="number" formControlName="stepLoadKg"/>
                          </mat-form-field>
                        </div>
                      </ng-container>

                      <!-- CHIPPER (Cap en MINUTOS) -->
                      <ng-container *ngSwitchCase="'chipper'">
                        <div class="row-auto">
                          <mat-form-field appearance="outline" class="w">
                            <mat-label>Cap (minutos)</mat-label>
                            <input matInput type="number" formControlName="capMinutes" />
                          </mat-form-field>
                        </div>
                        <div class="movements">
                          <h4>Secuencia</h4>
                          <div formArrayName="movements">
                            <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button" aria-label="Eliminar movimiento">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                        </div>
                      </ng-container>

                      <!-- TABATA (Trabajo/Descanso en MINUTOS) -->
                      <ng-container *ngSwitchCase="'tabata'">
                        <div class="row-3">
                          <mat-form-field class="w">
                            <mat-label>Trabajo (min)</mat-label>
                            <input matInput type="number" formControlName="workMinutes"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Descanso (min)</mat-label>
                            <input matInput type="number" formControlName="restMinutes"/>
                          </mat-form-field>
                          <mat-form-field class="w">
                            <mat-label>Rondas</mat-label>
                            <input matInput type="number" formControlName="rounds"/>
                          </mat-form-field>
                        </div>
                        <div class="movements">
                          <h4>Movimientos</h4>
                          <div formArrayName="movements">
                            <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps (opcional)</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button" aria-label="Eliminar movimiento">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                        </div>
                      </ng-container>

                      <!-- BENCHMARK (Cap en MINUTOS) -->
                      <ng-container *ngSwitchCase="'benchmark'">
                        <div class="row-auto">
                          <mat-form-field class="w">
                            <mat-label>Nombre Benchmark</mat-label>
                            <input matInput formControlName="name"/>
                          </mat-form-field>
                        </div>
                        <mat-form-field class="w col-2">
                          <mat-label>Referencia/Notas</mat-label>
                          <input matInput formControlName="reference"/>
                        </mat-form-field>
                        <div class="row-auto">
                          <mat-form-field appearance="outline" class="w">
                            <mat-label>Cap (minutos)</mat-label>
                            <input matInput type="number" formControlName="capMinutes" />
                          </mat-form-field>
                        </div>
                        <div class="movements">
                          <h4>Movimientos</h4>
                          <div formArrayName="movements">
                            <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                              <div class="mv">
                                <mat-form-field class="w">
                                  <mat-label>Ejercicio</mat-label>
                                  <input matInput formControlName="name"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Reps</mat-label>
                                  <input matInput type="number" formControlName="reps"/>
                                </mat-form-field>
                                <mat-form-field class="w">
                                  <mat-label>Carga (kg)</mat-label>
                                  <input matInput type="number" formControlName="loadKg"/>
                                </mat-form-field>
                                <mat-form-field class="grow w">
                                  <mat-label>Notas</mat-label>
                                  <input matInput formControlName="notes"/>
                                </mat-form-field>
                                <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button" aria-label="Eliminar movimiento">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </ng-container>
                          </div>
                          <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                        </div>
                      </ng-container>

                    </ng-container>
                  </div>
                </div>
              </section>
              <!-- ======= /Editor de bloques ======= -->

              <div class="actions col-2">
                <button mat-raised-button color="primary" type="submit" class="submit" [disabled]="form.invalid || loading">
                  {{ loading ? 'Creando...' : 'Crear WOD' }}
                </button>
              </div>
            </form>
          </section>

          <!-- Listado y edición rápida (fuera del form) -->
          <section class="card">
            <div class="table-wrap">
              <table mat-table [dataSource]="wods" class="wods-table mat-elevation-z1">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Nombre</th>
                  <td mat-cell *matCellDef="let w">
                    <input *ngIf="editId===w.id; else viewName" matInput [(ngModel)]="editName" />
                    <ng-template #viewName>{{ w.name }}</ng-template>
                  </td>
                </ng-container>

                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef>Categoría</th>
                  <td mat-cell *matCellDef="let w">
                    <ng-container *ngIf="editId===w.id; else viewCat">
                      <mat-select [(ngModel)]="editCategory">
                        <mat-option value="RX">RX</mat-option>
                        <mat-option value="Intermedio">Intermedio</mat-option>
                      </mat-select>
                    </ng-container>
                    <ng-template #viewCat>{{ w.category }}</ng-template>
                  </td>
                </ng-container>

                <ng-container matColumnDef="scoring">
                  <th mat-header-cell *matHeaderCellDef>Scoring</th>
                  <td mat-cell *matCellDef="let w">{{ w.scoringMode }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let w" class="row-actions">
                    <button *ngIf="editId!==w.id" mat-stroked-button color="primary" (click)="startEdit(w)" type="button">Editar</button>
                    <button *ngIf="editId===w.id" mat-raised-button color="primary" (click)="saveEdit(w)" type="button">Guardar</button>
                    <button *ngIf="editId===w.id" mat-button (click)="cancelEdit()" type="button">Cancelar</button>
                    <button mat-stroked-button color="warn" (click)="remove(w)" type="button">Eliminar</button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="cols"></tr>
                <tr mat-row *matRowDef="let row; columns: cols;"></tr>
              </table>
            </div>
          </section>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    /* ===== Shell + colores coherentes ===== */
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

    /* ===== Form grid (mobile-first) ===== */
    .grid { display:grid; grid-template-columns: minmax(0,1fr); gap:12px; align-items:start; width:100%; }
    .w { width:100%; min-width:0; }
    .submit { width:100%; } /* full en móvil */
    .col-2 { grid-column: 1 / -1; }

    /* filas compactas para grupos cortos */
    .row-auto { display:grid; grid-template-columns: minmax(0,1fr); gap:8px; }
    .row-3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; }
    .row-4 { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:8px; }

    /* Editor de bloques */
    .blocks { margin: 4px 0 0; }
    .block-add { display:grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items:end; }
    .add-btn { white-space: nowrap; }
    .block-list { display:grid; gap: 14px; margin-top: 12px; }
    .block { border: 1px solid #f0f0f0; border-radius: 12px; padding: 12px; }
    .block-head { display:flex; align-items:center; gap:8px; margin-bottom: 8px; }
    .spacer { flex:1; }

    .movements { display:grid; gap: 8px; margin-top: 8px; }
    .mv {
      display:grid;
      grid-template-columns: repeat(4, minmax(0,1fr)) auto; /* móvil: 4 inputs + botón */
      gap: 8px; align-items: end;
    }
    .grow { width: 100%; }

    /* ===== Tabla ===== */
    .table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #f0f0f0; width:100%; max-width:100%; }
    table { width:100%; background:#fff; }
    .wods-table thead th { background: rgba(252,85,0,0.06); color:#333; font-weight:700; }
    .wods-table td, .wods-table th { padding: 12px 14px; white-space: nowrap; }
    .wods-table tr:hover td { background: rgba(252,85,0,0.04); }
    .row-actions { display:flex; gap:8px; flex-wrap:wrap; }

    /* ===== Mobile-first fixes anti-overflow ===== */
    :host, .layout-container, .content, .main, .card { max-width:100%; }
    .mat-sidenav-content { overflow-x: clip; }
    .mat-mdc-form-field { width:100%; min-width:0 !important; }
    .mdc-text-field, .mdc-text-field__input { width:100%; min-width:0; }
    .mat-mdc-select { width:100%; }
    *, *::before, *::after { box-sizing: border-box; }

    /* ===== Breakpoints ===== */
    @media (min-width: 600px) {
      .only-handset { display:inline-flex; }
      .grid { grid-template-columns: minmax(0,1fr) 220px 220px; }
      .submit { width:auto; justify-self:start; }
      .col-2 { grid-column: 1 / -1; }
      .mv { grid-template-columns: 1.2fr 0.7fr 0.7fr 1fr auto; }
    }
    @media (min-width: 960px) {
      .grid { grid-template-columns: 1.2fr 220px 220px 1fr; }
    }

    /* ===== Mobile tweaks ===== */
    @media (max-width: 599px) {
      .side { width: 86vw; }
      .card { padding:12px; border-radius:14px; }
      .row-3 { grid-template-columns: minmax(0,1fr); }
      .row-4 { grid-template-columns: minmax(0,1fr); }
    }


/* ======== ESCALA EN SM+ SIN OVERFLOW ======== */
@media (min-width: 600px) {
  .grid {
    /* usa minmax(0, …) para permitir encoger sin desbordar */
    grid-template-columns: minmax(0, 1fr) 220px auto;
  }
  .submit { width: auto; }
}

/* ======== TARJETAS MÓVILES ======== */
.cards, .team-card { width: 100%; max-width: 100%; }
.team-card { box-sizing: border-box; }

/* ======== TABLA: NUNCA ROMPER LÍNEA NI ANCHO DE PÁGINA ======== */
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;   /* si alguna columna insiste, scroll solo del contenedor */
  -webkit-overflow-scrolling: touch;
}
.teams-table { width: 100%; max-width: 100%; table-layout: auto; }
.teams-table td, .teams-table th {
  padding: 12px 14px;
  white-space: nowrap; /* puedes quitarlo si quieres corte de línea */
}

/* ======== SIDENAV: SIN EMPUJAR EL LAYOUT EN MÓVIL ======== */
.side { width: clamp(240px, 72vw, 270px); }
@media (max-width: 599px) {
  .only-handset { display:inline-flex; }
  .side { width: 86vw; }                 /* más estrecho en móvil */
  .main { padding: 12px; }
  .card { padding: 12px; border-radius: 14px; }
  .table-wrap { display: none; }         /* usamos cards en móvil */
  .tc-actions button { flex: 1 1 calc(50% - 8px); } /* botones 2 col */
}

/* ======== BOX-SIZING PARA EVITAR SUMA DE PADDINGS ======== */
*, *::before, *::after { box-sizing: border-box; }

  `]
})
export class AdminWodsComponent {
  private fb = inject(FormBuilder);
  private wodsSvc = inject(WodService);
  private bpo = inject(BreakpointObserver);
  auth = inject(AuthService);

  isHandset$ = this.bpo.observe([Breakpoints.Handset, '(max-width: 959px)'])
    .pipe(map(r => r.matches), shareReplay(1));

  loading = false;
  wods: Wod[] = [];
  cols = ['name', 'category', 'scoring', 'actions'];

  editId: string | null = null;
  editName = '';
  editCategory: Category = 'RX';

  newBlockTypeCtrl = this.fb.control<WodType>('amrap');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    category: ['RX' as Category, Validators.required],
    scoringMode: ['time' as ScoringMode, Validators.required],  // global
    movementUnit: ['reps' as 'kg' | 'lb' | 'reps'],
    blocks: this.fb.array<FormGroup>([])
  });

  constructor() {
    this.wodsSvc.listAll$().subscribe(ws => this.wods = ws);
  }

  // Helpers FormArray
  get blocks() { return this.form.get('blocks') as FormArray<FormGroup>; }

  movementGroup() {
    return this.fb.group({
      name: ['', Validators.required],
      reps: [null as number | null],
      loadKg: [null as number | null],
      notes: [''],
    });
  }

  defaultBlock(type: WodType): FormGroup {
    switch (type) {
      case 'amrap':
        return this.fb.group({
          type: ['amrap'],
          minutes: [12, Validators.required],
          movements: this.fb.array([this.movementGroup()])
        });
      case 'for_time':
        return this.fb.group({
          type: ['for_time'],
          capMinutes: [10], // UI en minutos
          movements: this.fb.array([this.movementGroup()])
        });
      case 'emom':
        return this.fb.group({
          type: ['emom'],
          minutes: [10, Validators.required],
          perMinute: this.fb.array([this.movementGroup()])
        });
      case 'interval':
        return this.fb.group({
          type: ['interval'],
          workMinutes: [1, Validators.required],   // UI en minutos
          restMinutes: [1, Validators.required],   // UI en minutos
          rounds: [6, Validators.required],
          movements: this.fb.array([this.movementGroup()])
        });
      case 'for_load':
        return this.fb.group({
          type: ['for_load'],
          liftType: ['Clean & Jerk', Validators.required],
          attempts: [3],
          minLoadKg: [null],
          stepLoadKg: [null],
        });
      case 'chipper':
        return this.fb.group({
          type: ['chipper'],
          capMinutes: [15], // UI en minutos
          movements: this.fb.array([this.movementGroup()])
        });
      case 'tabata':
        return this.fb.group({
          type: ['tabata'],
          workMinutes: [1, Validators.required],  // UI en minutos
          restMinutes: [1, Validators.required],  // UI en minutos
          rounds: [8, Validators.required],
          movements: this.fb.array([this.movementGroup()])
        });
      case 'benchmark':
        return this.fb.group({
          type: ['benchmark'],
          name: ['Fran', Validators.required],
          reference: [''],
          capMinutes: [10], // UI en minutos
          movements: this.fb.array([this.movementGroup()])
        });
    }
  }

  addBlock() {
    const type = this.newBlockTypeCtrl.value as WodType;
    const g = this.defaultBlock(type);
    this.blocks.push(g);
  }

  removeBlock(i: number) {
    this.blocks.removeAt(i);
  }

  moveBlock(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= this.blocks.length) return;
    const ctrl = this.blocks.at(i);
    this.blocks.removeAt(i);
    this.blocks.insert(target, ctrl);
  }

  // Movements helpers (según tipo)
  movements(blockIndex: number) {
    return this.blocks.at(blockIndex).get('movements') as FormArray<FormGroup>;
  }
  perMinute(blockIndex: number) {
    return this.blocks.at(blockIndex).get('perMinute') as FormArray<FormGroup>;
  }
  addMovement(blockIndex: number) {
    this.movements(blockIndex).push(this.movementGroup());
  }
  removeMovement(blockIndex: number, j: number) {
    this.movements(blockIndex).removeAt(j);
  }
  addPerMinute(blockIndex: number) {
    this.perMinute(blockIndex).push(this.movementGroup());
  }
  removePerMinute(blockIndex: number, j: number) {
    this.perMinute(blockIndex).removeAt(j);
  }

  private mapBlocksUiToDto(blocks: any[]): any[] {
    return blocks.map((blk) => {
      switch (blk.type) {
        case 'for_time':
        case 'chipper':
        case 'benchmark':
          return {
            ...blk,
            capSeconds: Math.round((blk.capMinutes ?? 0) * 60),
          };
        case 'interval':
        case 'tabata':
          return {
            ...blk,
            workSeconds: Math.round((blk.workMinutes ?? 0) * 60),
            restSeconds: Math.round((blk.restMinutes ?? 0) * 60),
          };
        default:
          return blk;
      }
    });
  }

  async create() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const raw = this.form.getRawValue();

      // Validaciones mínimas según bloques (en MINUTOS donde aplique)
      for (const blk of raw.blocks) {
        if (blk['type'] === 'amrap' && (!blk['minutes'] || blk['minutes'] <= 0)) {
          alert('AMRAP: minutos debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'emom' && (!blk['minutes'] || blk['minutes'] <= 0)) {
          alert('EMOM: minutos debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'for_time' && (!blk['capMinutes'] || blk['capMinutes'] <= 0)) {
          alert('FOR TIME: cap (min) debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'chipper' && (!blk['capMinutes'] || blk['capMinutes'] <= 0)) {
          alert('CHIPPER: cap (min) debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'benchmark' && (!blk['capMinutes'] || blk['capMinutes'] <= 0)) {
          alert('BENCHMARK: cap (min) debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'interval' && (!blk['workMinutes'] || !blk['restMinutes'] || !blk['rounds'])) {
          alert('INTERVAL: trabajo/descanso/rondas inválidos');
          this.loading = false; return;
        }
        if (blk['type'] === 'tabata' && (!blk['workMinutes'] || !blk['restMinutes'] || !blk['rounds'])) {
          alert('TABATA: trabajo/descanso/rondas inválidos');
          this.loading = false; return;
        }
      }

      const blocksDto = this.mapBlocksUiToDto(raw.blocks as any[]);

      await this.wodsSvc.create({
        name: raw.name!,
        description: raw.description || '',
        category: raw.category!,
        scoringMode: raw.scoringMode!,     // time | reps | load
        movementUnit: raw.movementUnit!,
        blocks: blocksDto as any,          // convertido a segundos donde aplique
        createdAt: 0,                      // lo rellena el servicio
        createdBy: '',                     // lo rellena el servicio
      } as any);

      // Reset
      this.form.reset({
        name: '',
        description: '',
        category: 'RX',
        scoringMode: 'time',
        movementUnit: 'reps',
        blocks: []
      });
      this.blocks.clear();

    } catch (e: any) {
      alert(e?.message || 'Error al crear WOD');
    } finally {
      this.loading = false;
    }
  }

  startEdit(w: Wod) {
    this.editId = w.id;
    this.editName = w.name;
    this.editCategory = w.category;
  }
  cancelEdit() { this.editId = null; }
  async saveEdit(w: Wod) {
    if (!this.editId) return;
    await this.wodsSvc.update(w.id, { name: this.editName, category: this.editCategory });
    this.editId = null;
  }
  async remove(w: Wod) {
    if (!confirm(`Eliminar WOD "\${w.name}"?`)) return;
    await this.wodsSvc.remove(w.id);
  }

  closeOnMobile(drawer: { close: () => void }) {
    this.isHandset$.subscribe(isMobile => { if (isMobile) drawer.close(); }).unsubscribe();
  }

  logout() { this.auth.logout(); }

}
