import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
    <app-portal-header />
    <router-outlet />
  `,
})
export class AppComponent {}
