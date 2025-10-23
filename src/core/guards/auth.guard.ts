// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Espera a que Firebase restaure sesión (muy clave en Angular 20)
  await auth.authStateReady();

  if (auth.currentUser) return true;
  router.navigate(['/auth/login']);
  return false;
};
