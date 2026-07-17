import { Injectable } from '@angular/core';

/**
 * Seam de navegación externa (misma pestaña). Punto de sustitución para
 * EUD-164 (redirección real a identificación) y mockeable en tests.
 */
@Injectable({ providedIn: 'root' })
export class ExternalNavigator {
  redirect(url: string): void {
    window.location.href = url;
  }
}
