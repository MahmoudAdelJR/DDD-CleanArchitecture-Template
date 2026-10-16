import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppPermissions } from './app-permissions';
import { HasPermissionDirective } from './has-permission.directive';
import { AuthSessionService } from '../services/auth-session.service';
import { STORAGE } from '../storage/storage.port';
import { MemoryStorage } from '../testing/memory-storage';

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `
    <ng-container *appHasPermission="required; else denied">
      <span class="granted">granted</span>
    </ng-container>
    <ng-template #denied><span class="denied">denied</span></ng-template>
  `,
})
class HostComponent {
  required: string | readonly string[] = AppPermissions.customersWrite;
}

describe('HasPermissionDirective', () => {
  let session: AuthSessionService;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), { provide: STORAGE, useClass: MemoryStorage }],
    });

    session = TestBed.inject(AuthSessionService);
    fixture = TestBed.createComponent(HostComponent);
  });

  afterEach(() => {
    session.clearSession();
  });

  function renderedClass(): string | null {
    fixture.detectChanges();
    const node = fixture.nativeElement.querySelector('.granted, .denied');
    return node ? node.className : null;
  }

  function signIn(permissions: string[]): void {
    session.setSession({
      user: { id: '1', fullName: 'T', email: 't@e.x', permissions, roles: [] },
      accessToken: 'token',
      expiresAt: null,
    });
  }

  it('renders the main view when the single permission is granted', () => {
    signIn([AppPermissions.customersWrite]);
    expect(renderedClass()).toBe('granted');
  });

  it('renders the else template when not granted', () => {
    signIn([AppPermissions.customersRead]);
    expect(renderedClass()).toBe('denied');
  });

  it('requires all permissions for an array binding by default', () => {
    fixture.componentInstance.required = [
      AppPermissions.customersRead,
      AppPermissions.customersWrite,
    ];
    signIn([AppPermissions.customersRead]);
    expect(renderedClass()).toBe('denied');

    signIn([AppPermissions.customersRead, AppPermissions.customersWrite]);
    expect(renderedClass()).toBe('granted');
  });

  it('reacts when the session changes', () => {
    signIn([]);
    expect(renderedClass()).toBe('denied');

    signIn([AppPermissions.customersWrite]);
    expect(renderedClass()).toBe('granted');
  });
});
