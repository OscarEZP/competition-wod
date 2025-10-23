import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { ROLES, Role } from '../../../core/models/role';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule],
  template: `
    <h2>Crear cuenta</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Nombre</mat-label>
        <input matInput formControlName="displayName"/>
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Email</mat-label>
        <input matInput formControlName="email" type="email"/>
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Contraseña</mat-label>
        <input matInput formControlName="password" type="password"/>
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Rol</mat-label>
        <mat-select formControlName="role">
          <mat-option *ngFor="let r of roles" [value]="r">{{ r }}</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-raised-button color="primary" [disabled]="form.invalid || loading">
        {{ loading ? 'Creando...' : 'Registrar' }}
      </button>
    </form>

    <p><a routerLink="/auth/login">¿Ya tienes cuenta? Inicia sesión</a></p>
  `,
  styles: [`.w-100 { width: 100%; max-width: 380px; display:block; }`]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  roles = ROLES;
  loading = false;

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
