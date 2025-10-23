// ...existing code...
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '../../../../core/models/team';
import { Wod, WodType, ScoringMode } from '../../../../core/models/wod';
import { WodService } from '../../../../core/services/wod.service';

@Component({
  standalone: true,
  selector: 'app-admin-wods',
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule
  ],
  template: `
    <h2>WODs (Admin)</h2>

    <!-- Abrimos UN SOLO form y mantenemos DENTRO el editor de bloques -->
    <form [formGroup]="form" (ngSubmit)="create()" class="grid">
      <mat-form-field appearance="outline">
        <mat-label>Nombre</mat-label>
        <input matInput formControlName="name" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Categoría</mat-label>
        <mat-select formControlName="category">
          <mat-option value="RX">RX</mat-option>
          <mat-option value="Intermedio">Intermedio</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Scoring principal</mat-label>
        <mat-select formControlName="scoringMode">
          <mat-option value="time">Time</mat-option>
          <mat-option value="reps">Reps</mat-option>
          <mat-option value="load">Load</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="col-2">
        <mat-label>Descripción</mat-label>
        <textarea matInput rows="2" formControlName="description"></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Unidad predeterminada</mat-label>
        <mat-select formControlName="movementUnit">
          <mat-option value="kg">kg</mat-option>
          <mat-option value="lb">lb</mat-option>
          <mat-option value="reps">reps</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- ======= Editor de bloques (DENTRO del form) ======= -->
      <section class="blocks col-2">
        <h3>Bloques del WOD</h3>
        <div class="block-add">
          <mat-form-field appearance="outline">
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
          <button mat-stroked-button color="primary" (click)="addBlock()" type="button">
            Añadir bloque
          </button>
        </div>

        <div formArrayName="blocks" class="block-list" *ngIf="blocks.controls.length">
          <div class="block" *ngFor="let blk of blocks.controls; let i = index" [formGroupName]="i">
            <div class="block-head">
              <strong>{{ blocks.at(i).value.type | uppercase }}</strong>
              <span class="spacer"></span>
              <button mat-icon-button (click)="moveBlock(i, -1)" [disabled]="i===0" type="button">
                <mat-icon>arrow_upward</mat-icon>
              </button>
              <button mat-icon-button (click)="moveBlock(i, 1)"  [disabled]="i===blocks.length-1" type="button">
                <mat-icon>arrow_downward</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="removeBlock(i)" type="button">
                <mat-icon>delete</mat-icon>
              </button>
            </div>

            <!-- Campos específicos por tipo -->
            <ng-container [ngSwitch]="blocks.at(i).value.type">

              <!-- AMRAP -->
              <ng-container *ngSwitchCase="'amrap'">
                <mat-form-field appearance="outline">
                  <mat-label>Duración (min)</mat-label>
                  <input matInput type="number" formControlName="minutes" />
                </mat-form-field>
                <div class="movements">
                  <h4>Movimientos</h4>
                  <div formArrayName="movements">
                    <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </ng-container>
                  </div>
                  <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                </div>
              </ng-container>

              <!-- FOR TIME -->
              <ng-container *ngSwitchCase="'for_time'">
                <mat-form-field appearance="outline">
                  <mat-label>Cap (segundos)</mat-label>
                  <input matInput type="number" formControlName="capSeconds" />
                </mat-form-field>
                <div class="movements">
                  <h4>Trabajo a completar</h4>
                  <div formArrayName="movements">
                    <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button">
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
                <mat-form-field appearance="outline">
                  <mat-label>Duración (min)</mat-label>
                  <input matInput type="number" formControlName="minutes" />
                </mat-form-field>
                <div class="movements">
                  <h4>Por minuto</h4>
                  <div formArrayName="perMinute">
                    <ng-container *ngFor="let m of perMinute(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removePerMinute(i, j)" type="button">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </ng-container>
                  </div>
                  <button mat-stroked-button (click)="addPerMinute(i)" type="button">Añadir por-minuto</button>
                </div>
              </ng-container>

              <!-- INTERVAL -->
              <ng-container *ngSwitchCase="'interval'">
                <mat-form-field>
                  <mat-label>Trabajo (s)</mat-label>
                  <input matInput type="number" formControlName="workSeconds"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Descanso (s)</mat-label>
                  <input matInput type="number" formControlName="restSeconds"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Rondas</mat-label>
                  <input matInput type="number" formControlName="rounds"/>
                </mat-form-field>
                <div class="movements">
                  <h4>Movimientos por intervalo</h4>
                  <div formArrayName="movements">
                    <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button">
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
                <mat-form-field>
                  <mat-label>Levantamiento</mat-label>
                  <input matInput formControlName="liftType"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Intentos</mat-label>
                  <input matInput type="number" formControlName="attempts"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Peso mínimo (kg)</mat-label>
                  <input matInput type="number" formControlName="minLoadKg"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Incremento (kg)</mat-label>
                  <input matInput type="number" formControlName="stepLoadKg"/>
                </mat-form-field>
              </ng-container>

              <!-- CHIPPER -->
              <ng-container *ngSwitchCase="'chipper'">
                <mat-form-field appearance="outline">
                  <mat-label>Cap (segundos)</mat-label>
                  <input matInput type="number" formControlName="capSeconds" />
                </mat-form-field>
                <div class="movements">
                  <h4>Secuencia</h4>
                  <div formArrayName="movements">
                    <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </ng-container>
                  </div>
                  <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                </div>
              </ng-container>

              <!-- TABATA -->
              <ng-container *ngSwitchCase="'tabata'">
                <mat-form-field>
                  <mat-label>Trabajo (s)</mat-label>
                  <input matInput type="number" formControlName="workSeconds"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Descanso (s)</mat-label>
                  <input matInput type="number" formControlName="restSeconds"/>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Rondas</mat-label>
                  <input matInput type="number" formControlName="rounds"/>
                </mat-form-field>
                <div class="movements">
                  <h4>Movimientos</h4>
                  <div formArrayName="movements">
                    <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps (opcional)</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </ng-container>
                  </div>
                  <button mat-stroked-button (click)="addMovement(i)" type="button">Añadir movimiento</button>
                </div>
              </ng-container>

              <!-- BENCHMARK -->
              <ng-container *ngSwitchCase="'benchmark'">
                <mat-form-field>
                  <mat-label>Nombre Benchmark</mat-label>
                  <input matInput formControlName="name"/>
                </mat-form-field>
                <mat-form-field class="col-2">
                  <mat-label>Referencia/Notas</mat-label>
                  <input matInput formControlName="reference"/>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Cap (segundos)</mat-label>
                  <input matInput type="number" formControlName="capSeconds" />
                </mat-form-field>
                <div class="movements">
                  <h4>Movimientos</h4>
                  <div formArrayName="movements">
                    <ng-container *ngFor="let m of movements(i).controls; let j = index" [formGroupName]="j">
                      <div class="mv">
                        <mat-form-field>
                          <mat-label>Ejercicio</mat-label>
                          <input matInput formControlName="name"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Reps</mat-label>
                          <input matInput type="number" formControlName="reps"/>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Carga (kg)</mat-label>
                          <input matInput type="number" formControlName="loadKg"/>
                        </mat-form-field>
                        <mat-form-field class="grow">
                          <mat-label>Notas</mat-label>
                          <input matInput formControlName="notes"/>
                        </mat-form-field>
                        <button mat-icon-button color="warn" (click)="removeMovement(i, j)" type="button">
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
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
          {{ loading ? 'Creando...' : 'Crear WOD' }}
        </button>
      </div>
    </form>

    <!-- Listado y edición rápida de nombre/categoría (fuera del form) -->
    <table mat-table [dataSource]="wods" class="mt">
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
        <td mat-cell *matCellDef="let w">
          <button *ngIf="editId!==w.id" mat-button (click)="startEdit(w)" type="button">Editar</button>
          <button *ngIf="editId===w.id" mat-button color="primary" (click)="saveEdit(w)" type="button">Guardar</button>
          <button *ngIf="editId===w.id" mat-button (click)="cancelEdit()" type="button">Cancelar</button>
          <button mat-button color="warn" (click)="remove(w)" type="button">Eliminar</button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(4, minmax(200px,1fr)); gap: 12px; align-items: start; max-width: 1100px; }
    .col-2 { grid-column: span 2; }
    .actions { grid-column: 1 / -1; }
    .blocks { margin: 24px 0; }
    .block-add { display:flex; gap: 12px; align-items: center; }
    .block-list { display: grid; gap: 16px; margin-top: 12px; }
    .block { border: 1px solid #4444; border-radius: 12px; padding: 12px; }
    .block-head { display:flex; align-items:center; gap:8px; margin-bottom: 8px; }
    .spacer { flex:1; }
    .movements { display: grid; gap: 8px; margin-top: 8px; }
    .mv { display: grid; grid-template-columns: 1.2fr 0.7fr 0.7fr 1fr auto; gap: 8px; align-items: center; }
    .grow { width: 100%; }
    .mt { margin-top: 24px; width: 100%; max-width: 1100px; }
  `]
})
export class AdminWodsComponent {
  private fb = inject(FormBuilder);
  private wodsSvc = inject(WodService);

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
          capSeconds: [600],
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
          workSeconds: [40, Validators.required],
          restSeconds: [20, Validators.required],
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
          capSeconds: [900],
          movements: this.fb.array([this.movementGroup()])
        });
      case 'tabata':
        return this.fb.group({
          type: ['tabata'],
          workSeconds: [20, Validators.required],
          restSeconds: [10, Validators.required],
          rounds: [8, Validators.required],
          movements: this.fb.array([this.movementGroup()])
        });
      case 'benchmark':
        return this.fb.group({
          type: ['benchmark'],
          name: ['Fran', Validators.required],
          reference: [''],
          capSeconds: [600],
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

  async create() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const raw = this.form.getRawValue();

      // Validaciones mínimas según bloques
      for (const blk of raw.blocks) {
        if (blk['type'] === 'amrap' && (!blk['minutes'] || blk['minutes'] <= 0)) {
          alert('AMRAP: minutos debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'emom' && (!blk['minutes'] || blk['minutes'] <= 0)) {
          alert('EMOM: minutos debe ser > 0');
          this.loading = false; return;
        }
        if (blk['type'] === 'interval' && (!blk['workSeconds'] || !blk['restSeconds'] || !blk['rounds'])) {
          alert('INTERVAL: trabajo/descanso/rondas inválidos');
          this.loading = false; return;
        }
      }

      await this.wodsSvc.create({
        name: raw.name!,
        description: raw.description || '',
        category: raw.category!,
        scoringMode: raw.scoringMode!,     // time | reps | load
        movementUnit: raw.movementUnit!,
        blocks: raw.blocks as any,         // tipado compatible con interfaz WodBlock
        createdAt: 0,                      // será reemplazado en el servicio
        createdBy: '',                     // será reemplazado en el servicio
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
    if (!confirm(`Eliminar WOD "${w.name}"?`)) return;
    await this.wodsSvc.remove(w.id);
  }
}
// ...existing code...