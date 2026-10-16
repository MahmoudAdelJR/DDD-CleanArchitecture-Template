import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="card error-page" role="alert">
      <h1>{{ 'forbidden.title' | tr }}</h1>
      <p class="muted">{{ 'forbidden.body' | tr }}</p>
      <a class="button" routerLink="/customers">{{ 'common.backToCustomers' | tr }}</a>
    </section>
  `,
  styles: `
    .error-page {
      text-align: center;
      margin-top: var(--space-6);
    }
  `,
})
export class ForbiddenPageComponent {}
