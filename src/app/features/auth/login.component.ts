import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="container-auth">
      <mat-card class="card-auth" appearance="outlined">
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;">
          <div class="brand-badge">CF</div>
          <h1 style="margin:0;font-size:1.5rem;line-height:1.2;">Iniciar sesión</h1>
          <p style="margin:0;color:#6b7280;font-size:.95rem">
            Bienvenido de nuevo 👋
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" style="margin-top:16px;display:grid;gap:12px;">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" autocomplete="email" />
            <mat-error *ngIf="form.controls.email.hasError('required')">El email es obligatorio</mat-error>
            <mat-error *ngIf="form.controls.email.hasError('email')">Formato de email no válido</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput [type]="hide() ? 'password' : 'text'" formControlName="password" autocomplete="current-password"/>
            <button mat-icon-button matSuffix type="button" (click)="toggle()" [attr.aria-label]="'Mostrar contraseña'">
              <mat-icon>{{ hide() ? 'visibility' : 'visibility_off' }}</mat-icon>
            </button>
            <mat-error *ngIf="form.controls.password.hasError('required')">La contraseña es obligatoria</mat-error>
            <mat-error *ngIf="form.controls.password.hasError('minlength')">Mínimo 6 caracteres</mat-error>
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
            <ng-container *ngIf="!loading; else loadingTpl">Entrar</ng-container>
          </button>
          <ng-template #loadingTpl>
            <span style="display:inline-flex;gap:10px;align-items:center;">
              <mat-progress-spinner mode="indeterminate" diameter="18"></mat-progress-spinner>
              Cargando…
            </span>
          </ng-template>
        </form>

        <div style="margin-top:14px;font-size:.95rem;">
          <a class="link" routerLink="/auth/register">Crear cuenta</a>
        </div>
      </mat-card>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = false;
  #hide = signal(true);
  hide = () => this.#hide();
  toggle = () => this.#hide.update(v => !v);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email!, password!);
      this.router.navigateByUrl('/');
    } catch (e: any) {
      // Puedes reemplazar por un snackbar si lo prefieres
      alert(e?.message || 'Error de inicio de sesión');
    } finally {
      this.loading = false;
    }
  }
}
