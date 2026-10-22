import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PortalConfigService } from './core/config/portal-config.service';
import { PortalHeaderComponent } from './shared/components/portal-header/portal-header.component';

/**
 * AppComponent: raíz de la aplicación, con la cabecera común encima de cada
 * pantalla. No lee datos del titular de la dirección ni del almacenamiento
 * del navegador: la sesión del recorrido vive solo en el servicio del portal
 * (design.md AD-3).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PortalHeaderComponent],
  template: `
    <app-portal-header [neutral]="configUnavailable()" />
    <router-outlet />
  `,
})
export class AppComponent {
  private readonly portalConfig = inject(PortalConfigService);

  /** Sin configuración del tenant, la cabecera es neutra (prd.md §3.4). */
  protected readonly configUnavailable = computed(() => this.portalConfig.state().status === 'unavailable');
}
