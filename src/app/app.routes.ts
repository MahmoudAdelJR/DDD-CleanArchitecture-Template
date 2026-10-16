import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AuthenticatedLayoutComponent } from './shell/authenticated-layout/authenticated-layout.component';
import { ForbiddenPageComponent } from './shell/pages/forbidden-page.component';
import { NotFoundPageComponent } from './shell/pages/not-found-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'customers' },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: AuthenticatedLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./features/identity/identity.routes').then((m) => m.IDENTITY_ROUTES),
      },
      { path: 'forbidden', component: ForbiddenPageComponent },
    ],
  },
  { path: '**', component: NotFoundPageComponent },
];
