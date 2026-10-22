import { Component, EnvironmentInjector, inject, runInInjectionContext, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { loadPortalConfiguration } from '../../core/branding/branding.initializer';

/**
 * Configuración del portal no disponible (prd.md §3.4): sin detalles internos
 * y con la cabecera neutra. "Volver a intentarlo" vuelve a pedir la
 * configuración y, si responde, aplica marca e idioma y va a Inicio.
 */
@Component({
  selector: 'app-config-unavailable',
  imports: [TranslateModule],
  templateUrl: './config-unavailable.component.html',
})
export class ConfigUnavailableComponent {
  private readonly router = inject(Router);
  private readonly injector = inject(EnvironmentInjector);

  protected readonly retrying = signal(false);

  async onRetry(): Promise<void> {
    if (this.retrying()) {
      return;
    }
    this.retrying.set(true);
    try {
      const state = await runInInjectionContext(this.injector, () => loadPortalConfiguration());
      if (state.status === 'loaded') {
        await this.router.navigate(['/']);
      }
    } finally {
      this.retrying.set(false);
    }
  }
}
