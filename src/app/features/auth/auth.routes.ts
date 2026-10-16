import { Routes } from '@angular/router';
import { SignInPageComponent } from './sign-in/sign-in-page.component';
import { SignInStore } from './sign-in/sign-in.store';
import { SignInUseCase } from './sign-in/sign-in.use-case';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: SignInPageComponent,
    providers: [SignInStore, SignInUseCase],
  },
];
