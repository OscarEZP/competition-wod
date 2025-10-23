import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2>Iniciar sesión</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Email</mat-label>
        <input matInput formControlName="email" type="email"/>
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Contraseña</mat-label>
        <input matInput formControlName="password" type="password"/>
      </mat-form-field>

      <button mat-raised-button color="primary" [disabled]="form.invalid || loading">
        {{ loading ? 'Cargando...' : 'Entrar' }}
      </button>
    </form>

    <p><a routerLink="/auth/register">Crear cuenta</a></p>
  `,
  styles: [`.w-100 { width: 100%; max-width: 380px; display:block; }`]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = false;
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async submit() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email!, password!);
      this.router.navigate(['/']);
    } catch (e: any) {
      alert(e?.message || 'Error de inicio de sesión');
    } finally {
      this.loading = false;
    }
  }
}
