import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { Role } from '../models/role';

export const roleGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const auth = inject(Auth);
  const authSvc = inject(AuthService);
  const allowed: Role[] = route.data['roles'] ?? [];

  console.log('🔒 [roleGuard] Iniciando comprobación de roles...');
  console.log('👉 Roles permitidos para esta ruta:', allowed);

  await auth.authStateReady();
  const user = auth.currentUser;

  if (!user) {
    console.warn('⚠️ [roleGuard] No hay usuario autenticado. Redirigiendo a /auth/login');
    router.navigate(['/auth/login']);
    return false;
  }

  console.log('✅ [roleGuard] Usuario autenticado:', {
    uid: user.uid,
    email: user.email,
  });

  try {
    const appUser = await firstValueFrom(authSvc.appUser$);
    console.log('📄 [roleGuard] Perfil de usuario obtenido desde Firestore:', appUser);

    if (appUser && allowed.includes(appUser.role)) {
      console.log(`✅ [roleGuard] Acceso permitido. Rol: ${appUser.role}`);
      return true;
    }

    console.warn(`🚫 [roleGuard] Rol no autorizado. Rol actual: ${appUser?.role}, permitidos: ${allowed}`);
    router.navigate(['/']);
    return false;
  } catch (err) {
    console.error('❌ [roleGuard] Error al obtener perfil de usuario:', err);
    router.navigate(['/auth/login']);
    return false;
  }
};
