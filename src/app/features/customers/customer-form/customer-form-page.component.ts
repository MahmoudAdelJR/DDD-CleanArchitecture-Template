import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { applyServerValidationErrors } from '../../../core/http/server-validation.mapper';
import { PendingChanges } from '../../../core/guards/unsaved-changes.guard';
import { NotificationService } from '../../../core/services/notification.service';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { FieldErrorComponent } from '../../../shared/forms/field-error.component';
import { trimmedRequired } from '../../../shared/forms/validators';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { TRANSLATION } from '../../../shared/i18n/translation.port';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { CustomerFormStore } from '../customer-form.store';
import type { CustomerInput, CustomerStatus } from '../data-access/customer.models';

type FieldName = 'company' | 'contactName' | 'email' | 'city' | 'status' | 'notes';

/**
 * Create/edit customer form. One component, two routes (`/customers/new` and
 * `/customers/:id/edit`): the presence of an `:id` param selects edit mode.
 */
@Component({
  selector: 'app-customer-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AutofocusDirective,
    FieldErrorComponent,
    TranslatePipe,
    PageHeaderComponent,
  ],
  templateUrl: './customer-form-page.component.html',
  styleUrl: './customer-form-page.component.scss',
})
export class CustomerFormPageComponent implements PendingChanges {
  private readonly store = inject(CustomerFormStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly translations = inject(TRANSLATION, { optional: true });

  protected readonly editingId = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.editingId() !== null);
  protected readonly status = this.store.status;
  protected readonly isSaving = this.store.isSaving;
  protected readonly loadError = this.store.loadError;
  protected readonly saveError = this.store.saveError;
  protected readonly notFound = this.store.notFound;
  protected readonly submitted = signal(false);
  protected readonly statuses: readonly CustomerStatus[] = ['active', 'inactive'];

  protected readonly form = this.fb.nonNullable.group({
    company: ['', [trimmedRequired(), Validators.maxLength(120)]],
    contactName: ['', [trimmedRequired(), Validators.maxLength(120)]],
    email: ['', [trimmedRequired(), Validators.email, Validators.maxLength(200)]],
    city: ['', [trimmedRequired(), Validators.maxLength(80)]],
    status: this.fb.nonNullable.control<CustomerStatus>('active'),
    notes: ['', Validators.maxLength(1000)],
  });

  private baseline = JSON.stringify(this.form.getRawValue());
  private saved = false;

  constructor() {
    void this.init(this.route.snapshot.paramMap.get('id'));
  }

  private async init(id: string | null): Promise<void> {
    if (id) {
      this.editingId.set(id);
      await this.store.load(id);
      const customer = this.store.customer();
      if (customer) {
        this.form.patchValue({
          company: customer.company,
          contactName: customer.contactName,
          email: customer.email,
          city: customer.city,
          status: customer.status,
          notes: customer.notes,
        });
        this.form.markAsPristine();
      }
    }
    this.baseline = JSON.stringify(this.form.getRawValue());
  }

  /** Used by `unsavedChangesGuard` to veto navigation away from dirty edits. */
  hasUnsavedChanges(): boolean {
    return !this.saved && JSON.stringify(this.form.getRawValue()) !== this.baseline;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    const saved = await this.store.save(id, this.toInput());

    if (!saved) {
      const serverError = this.store.serverError();
      if (serverError) {
        applyServerValidationErrors(this.form, serverError);
      }
      return;
    }

    this.saved = true;
    this.notifications.success(
      id
        ? this.translation('customers.savedUpdated', 'Customer updated.')
        : this.translation('customers.savedCreated', 'Customer created.'),
    );
    await this.router.navigate(['/customers', saved.id]);
  }

  protected retryLoad(): void {
    const id = this.editingId();
    if (id) {
      void this.init(id);
    }
  }

  protected isInvalid(field: FieldName): boolean {
    return this.form.controls[field].invalid;
  }

  protected shouldShowFieldError(field: FieldName): boolean {
    const control = this.form.controls[field];
    return (this.submitted() || control.touched) && control.invalid;
  }

  private toInput(): CustomerInput {
    const raw = this.form.getRawValue();
    return {
      company: raw.company.trim(),
      contactName: raw.contactName.trim(),
      email: raw.email.trim(),
      city: raw.city.trim(),
      status: raw.status,
      notes: (raw.notes ?? '').trim(),
    };
  }

  private translation(key: string, fallback: string): string {
    return this.translations?.translate(key, undefined, fallback) ?? fallback;
  }
}
