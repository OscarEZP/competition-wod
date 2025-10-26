import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { ROLES, Role } from '../../../core/models/role';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule, MatIconModule, MatToolbarModule,
    RouterLink,
  ],
  template: `
    <!-- Contenido centrado -->
    <main class="center-wrap">
      <section class="card">
        <h1 class="h">Crear cuenta</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <mat-form-field appearance="outline" class="w">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="displayName"/>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email"/>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w">
            <mat-label>Contraseña</mat-label>
            <input matInput [type]="hide ? 'password' : 'text'" formControlName="password"/>
            <button mat-icon-button matSuffix type="button" (click)="hide = !hide">
              <mat-icon>{{ hide ? 'visibility' : 'visibility_off' }}</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w">
            <mat-label>Rol</mat-label>
            <mat-select formControlName="role">
              <mat-option *ngFor="let r of roles" [value]="r">{{ r }}</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-raised-button color="primary" class="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Creando...' : 'Registrar' }}
          </button>
        </form>

        <p class="alt">
          <a routerLink="/auth/login">¿Ya tienes cuenta? Inicia sesión</a>
        </p>
      </section>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      background: linear-gradient(180deg, #ffffff 0%, #fff5f0 100%);
      color: #111;
      min-height: 100dvh;
      overflow-x: hidden;
    }

    /* Toolbar */
    .app-toolbar { position: sticky; top:0; z-index:3; }
    .brand {
      display:inline-grid; place-items:center; text-decoration:none;
      width:34px; height:34px; border-radius:10px; margin-right:10px;
      background:#fff; color:#FC5500; font-weight:800;
    }
    .title { font-weight:700; color:#fff; }
    .spacer { flex:1; }
    .login-link { color:#fff; }

    /* Centrado total */
    .center-wrap {
      min-height: calc(100dvh - 64px);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }

    .card {
      width: 100%;
      max-width: 460px;
      background: #fff;
      border: 1px solid #eee;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 28px rgba(0,0,0,.08);
    }

    .h {
      margin: 0 0 20px;
      font-size: clamp(1.4rem, 3.5vw, 1.8rem);
      font-weight: 900;
      color: #111;
      text-align: center;
    }

    /* Form mobile-first */
    .form-grid {
      display: grid;
      grid-template-columns: minmax(0,1fr);
      gap: 12px;
      width: 100%;
    }

    .w, .mat-mdc-form-field {
      width: 100%;
      min-width: 0 !important;
    }

    .mdc-text-field, .mdc-text-field__input, .mat-mdc-select {
      width: 100%;
      min-width: 0;
    }

    /* Botón full en móvil */
    .submit {
      width: 100%;
      margin-top: 8px;
    }

    /* Adaptación a pantallas medianas */
    @media (min-width: 720px) {
      .form-grid {
        grid-template-columns: repeat(2, minmax(0,1fr));
      }
      .submit {
        grid-column: 1 / -1;
        width: auto;
        justify-self: center;
        padding-inline: 36px;
      }
    }

    .alt {
      margin-top: 16px;
      text-align: center;
    }
    .alt a {
      color: #FC5500;
      font-weight: 700;
      text-decoration: none;
    }
    .alt a:hover {
      text-decoration: underline;
    }

    *, *::before, *::after { box-sizing: border-box; }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  roles = ROLES;
  loading = false;
  hide = true;

  form = this.fb.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['user' as Role, [Validators.required]],
  });

  async submit() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const { displayName, email, password, role } = this.form.getRawValue();
      await this.auth.register(email!, password!, displayName!, role!);
      this.router.navigate(['/']);
    } catch (e: any) {
      alert(e?.message || 'Error al registrar');
    } finally {
      this.loading = false;
    }
  }
}
