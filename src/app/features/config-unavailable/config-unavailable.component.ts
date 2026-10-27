import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { TenantLanguageService } from '../../core/branding/tenant-language.service';

/**
 * Configuración del portal no disponible (prd.md §3.4): sin detalles
 * internos, con la cabecera del tenant. "Volver a intentarlo" vuelve a pedir
 * la configuración y, si responde, recarga los textos para añadir los del
 * tenant y va a Inicio.
 */
@Component({
  selector: 'app-config-unavailable',
  imports: [TranslateModule],
  templateUrl: './config-unavailable.component.html',
})
export class ConfigUnavailableComponent {
  private readonly router = inject(Router);
  private readonly config = inject(PortalConfigService);
  private readonly language = inject(TenantLanguageService);

  protected readonly retrying = signal(false);

  async onRetry(): Promise<void> {
    if (this.retrying()) {
      return;
    }
    this.retrying.set(true);
    try {
      const state = await this.config.load();
      if (state.status === 'loaded') {
        this.language.reloadTexts();
        await this.router.navigate(['/']);
      }
    } finally {
      this.retrying.set(false);
    }
  }
}
