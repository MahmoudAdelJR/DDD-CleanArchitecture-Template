import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <section class="card error-page">
      <h1>Page not found</h1>
      <p class="muted">The page you requested does not exist.</p>
      <a class="button" routerLink="/customers">Go home</a>
    </section>
  `,
  styles: `
    .error-page {
      text-align: center;
      margin-top: var(--space-6);
    }
  `
})
export class NotFoundPageComponent {}
