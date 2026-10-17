import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig } from './app/app.config';
import { App } from './app/app';
import { loadRuntimeAppConfig } from './app/core/config/runtime-app-config';

async function bootstrap(): Promise<void> {
  const runtimeConfig = await loadRuntimeAppConfig();
  await bootstrapApplication(App, createAppConfig(runtimeConfig));
}

void bootstrap().catch((error: unknown) => {
  console.error('Application bootstrap failed.', error);
  const host = document.querySelector('app-root');
  if (host) {
    host.textContent = 'The application could not start. Check the runtime configuration.';
    host.setAttribute('role', 'alert');
  }
});
