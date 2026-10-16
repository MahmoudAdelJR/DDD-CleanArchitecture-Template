import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  template: `
    <section class="card error-page" role="alert">
      <h1>Access denied</h1>
      <p class="muted">You do not have permission to view this page.</p>
      <a class="button" routerLink="/customers">Back to customers</a>
    </section>
  `,
  styles: `
    .error-page {
      text-align: center;
      margin-top: var(--space-6);
    }
  `
})
export class ForbiddenPageComponent {}
