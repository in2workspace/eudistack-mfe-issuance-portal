import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * AppComponent: raíz de la aplicación. No lee datos del titular de la
 * dirección ni del almacenamiento del navegador: la sesión del recorrido vive
 * solo en el servicio del portal (design.md AD-3).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {}
