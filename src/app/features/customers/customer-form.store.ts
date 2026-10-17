import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, isApiError } from '../../core/http/api-error';
import { TRANSLATION } from '../../shared/i18n/translation.port';
import type { CustomerDetails, CustomerInput } from './data-access/customer.models';
import {
  CUSTOMER_REPOSITORY,
  CustomerConflictError,
  CustomerNotFoundError,
} from './data-access/customer.repository';

export type FormStatus = 'idle' | 'loading' | 'saving';

const GENERIC_SAVE_ERROR = 'The customer could not be saved. Please try again.';
const GENERIC_LOAD_ERROR = 'The customer could not be loaded. Please try again.';

/**
 * Feature-scoped state for the create/edit form. Split deliberately from
 * `CustomersStore` (list state) so the two route scopes never share mutable
 * state, and so server validation errors can be surfaced to the form owner.
 */
@Injectable()
export class CustomerFormStore {
  private readonly repository = inject(CUSTOMER_REPOSITORY);
  private readonly translation = inject(TRANSLATION, { optional: true });

  private readonly _status = signal<FormStatus>('idle');
  readonly status = this._status.asReadonly();

  private readonly _customer = signal<CustomerDetails | null>(null);
  readonly customer = this._customer.asReadonly();

  private readonly _loadError = signal<string | null>(null);
  readonly loadError = this._loadError.asReadonly();

  private readonly _saveError = signal<string | null>(null);
  readonly saveError = this._saveError.asReadonly();

  private readonly _notFound = signal(false);
  readonly notFound = this._notFound.asReadonly();

  /** Last 422 as a normalized ApiError, so the form can map field messages. */
  private readonly _serverError = signal<ApiError | null>(null);
  readonly serverError = this._serverError.asReadonly();

  readonly isSaving = computed(() => this._status() === 'saving');

  async load(id: string): Promise<void> {
    this._status.set('loading');
    this._loadError.set(null);
    this._notFound.set(false);

    try {
      this._customer.set(await this.repository.findById(id));
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        this._notFound.set(true);
      } else {
        this._loadError.set(this.toLoadMessage(error));
      }
    } finally {
      this._status.set('idle');
    }
  }

  async save(id: string | null, input: CustomerInput): Promise<CustomerDetails | null> {
    this._status.set('saving');
    this._saveError.set(null);
    this._serverError.set(null);

    try {
      const saved = id
        ? await this.repository.update(id, input)
        : await this.repository.create(input);
      this._customer.set(saved);
      return saved;
    } catch (error) {
      if (isApiError(error) && Object.keys(error.validationErrors).length > 0) {
        this._serverError.set(error);
      }
      this._saveError.set(this.toSaveMessage(error));
      return null;
    } finally {
      this._status.set('idle');
    }
  }

  private toSaveMessage(error: unknown): string {
    if (error instanceof CustomerConflictError) {
      return this.translate(
        'customers.errors.conflict',
        'A customer with this email already exists.',
      );
    }
    if (error instanceof CustomerNotFoundError) {
      return this.translate('customers.errors.notFound', 'This customer no longer exists.');
    }
    if (isApiError(error)) {
      // The error interceptor localizes/sanitizes ApiError.message already.
      return error.message;
    }
    return this.translate('customers.errors.save', GENERIC_SAVE_ERROR);
  }

  private toLoadMessage(error: unknown): string {
    return isApiError(error)
      ? error.message
      : this.translate('customers.errors.load', GENERIC_LOAD_ERROR);
  }

  private translate(key: string, fallback: string): string {
    return this.translation?.translate(key, undefined, fallback) ?? fallback;
  }
}
