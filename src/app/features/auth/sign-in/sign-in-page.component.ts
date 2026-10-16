import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { SignInStore } from './sign-in.store';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule, AutofocusDirective],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './sign-in-page.component.scss'
})
export class SignInPageComponent {
  private readonly store = inject(SignInStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly submitted = signal(false);
  protected readonly status = computed(() => this.store.status());
  protected readonly errorMessage = computed(() => this.store.errorMessage());

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  protected async submit(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid) {
      return;
    }

    const success = await this.store.submit({
      email: this.form.controls.email.value!,
      password: this.form.controls.password.value!
    });

    if (success) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/customers';
      await this.router.navigateByUrl(returnUrl);
    }
  }

  protected shouldShowFieldError(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return (this.submitted() || control.touched) && control.invalid;
  }
}
