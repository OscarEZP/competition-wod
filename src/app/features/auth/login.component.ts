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
    <div class="auth-wrap">
      <mat-card class="card-auth" appearance="outlined">
        <header class="card-head">
          <div class="brand-badge">CF</div>
          <h1 class="title">Iniciar sesión</h1>
          <p class="subtitle">Bienvenido de nuevo 👋</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <mat-form-field appearance="outline" class="w">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" autocomplete="email" />
            <mat-error *ngIf="form.controls.email.hasError('required')">El email es obligatorio</mat-error>
            <mat-error *ngIf="form.controls.email.hasError('email')">Formato de email no válido</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w">
            <mat-label>Contraseña</mat-label>
            <input matInput [type]="hide() ? 'password' : 'text'" formControlName="password" autocomplete="current-password"/>
            <button mat-icon-button matSuffix type="button" (click)="toggle()" [attr.aria-label]="hide() ? 'Mostrar contraseña' : 'Ocultar contraseña'">
              <mat-icon>{{ hide() ? 'visibility' : 'visibility_off' }}</mat-icon>
            </button>
            <mat-error *ngIf="form.controls.password.hasError('required')">La contraseña es obligatoria</mat-error>
            <mat-error *ngIf="form.controls.password.hasError('minlength')">Mínimo 6 caracteres</mat-error>
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" class="submit" [disabled]="form.invalid || loading">
            <ng-container *ngIf="!loading; else loadingTpl">Entrar</ng-container>
          </button>
          <ng-template #loadingTpl>
            <span class="loading-inline">
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
  styles: [`
    :host { display:block; background:#fff; min-height:100dvh; color:#111; }

    /* Fondo suave + centrado total */
    .auth-wrap{
      min-height:100dvh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:24px;
      background: linear-gradient(180deg, #ffffff 0%, #fff5f0 100%);
      overflow-x:hidden;
    }

    /* Card limpio */
    .card-auth{
      width:100%;
      max-width:460px;
      padding:22px 20px;
      border:1px solid #eee;
      border-radius:16px;
      box-shadow:0 8px 28px rgba(0,0,0,.08);
      background:#fff;
    }

    .card-head{ display:flex; flex-direction:column; gap:6px; align-items:flex-start; }
    .brand-badge{
      width:36px; height:36px; border-radius:10px;
      display:grid; place-items:center;
      background:#FC5500; color:#fff; font-weight:800;
      box-shadow:0 4px 12px rgba(252,85,0,.25);
    }
    .title{ margin:0; font-size:clamp(1.3rem, 3.8vw, 1.6rem); line-height:1.2; font-weight:900; color:#111; }
    .subtitle{ margin:0; color:#6b7280; font-size:.95rem; }

    /* Form mobile-first */
    .form-grid{ display:grid; grid-template-columns:minmax(0,1fr); gap:12px; margin-top:14px; }
    .w, .mat-mdc-form-field{ width:100%; min-width:0 !important; }
    .mdc-text-field, .mdc-text-field__input, .mat-mdc-select{ width:100%; min-width:0; }

    .submit{ width:100%; margin-top:4px; }

    .loading-inline{ display:inline-flex; gap:10px; align-items:center; }

    /* Botón secundario (ghost/outline) */
    .alt-actions{
      margin-top:14px;
      display:flex; justify-content:center;
    }
    .btn-secondary{
      /* mat-stroked-button ya da borde; reforzamos estilo "secundario" */
      --stroke-color: rgba(252,85,0,.35);
      border-color: var(--stroke-color) !important;
      background: transparent !important;
      font-weight:700;
    }
    .btn-secondary:hover{
      background: rgba(252,85,0,.06) !important;
      border-color: rgba(252,85,0,.6) !important;
    }

    /* Tablet+ */
    @media (min-width:720px){
      .card-auth{ padding:26px 22px; }
      .submit{ width:auto; justify-self:center; padding-inline:36px; }
    }

    /* Anti overflow global */
    *,*::before,*::after{ box-sizing:border-box; }
  `]
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
      alert(e?.message || 'Error de inicio de sesión');
    } finally {
      this.loading = false;
    }
  }
}
