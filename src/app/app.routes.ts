import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { authGuard } from '../core/guards/auth.guard';
import { roleGuard } from '../core/guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },

  // Ruta protegida (ejemplo) visible a cualquier usuario logueado:
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },

  // Ruta solo admins (ejemplo):
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
  },

  {
    path: 'admin/teams',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./features/admin/teams/admin-teams.component').then(m => m.AdminTeamsComponent),
  },

  {
    path: 'admin/wods',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./features/admin/wods/admin-wods.component').then(m => m.AdminWodsComponent),
  },

  // Usuario: crear/unirse/ver equipo
  {
    path: 'my-team',
    canActivate: [authGuard],
    loadComponent: () => import('./features/teams/my-team.component').then(m => m.MyTeamComponent),
  },

  {
  path: 'judge',
  canActivate: [authGuard, roleGuard],
  data: { roles: ['admin', 'juez'] },
  loadComponent: () => import('./features/judge/judge-panel.component').then(m => m.JudgePanelComponent),
},
{
  path: 'leaderboard',
  canActivate: [authGuard],
  loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
},

  // Auth
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  { path: '**', redirectTo: '' },
];
