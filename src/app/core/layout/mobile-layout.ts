import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Móvil para la pantalla QR (design.md AD-5): ancho menor de 768 px y
 * puntero táctil, no el agente de usuario. Una ventana estrecha con ratón o
 * una tableta ancha usan la disposición de ordenador (ac.md EC-08).
 */
export const MOBILE_LAYOUT_QUERY = '(max-width: 767.98px) and (pointer: coarse)';

/** Si el titular está en un móvil, y sigue los cambios (girar la pantalla, cambiar de ventana). */
@Injectable({ providedIn: 'root' })
export class MobileLayout {
  private readonly _mobile = signal(false);
  readonly mobile = this._mobile.asReadonly();

  constructor() {
    const media = inject(DOCUMENT).defaultView?.matchMedia?.(MOBILE_LAYOUT_QUERY);
    if (!media) {
      return;
    }
    this._mobile.set(media.matches);
    const onChange = (event: MediaQueryListEvent): void => this._mobile.set(event.matches);
    media.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
  }
}

/**
 * Abre el wallet del tenant en la misma pestaña (design.md §6: en otra
 * pestaña no funciona en el móvil). Inyectable para poder probarlo.
 */
export const OPEN_WALLET = new InjectionToken<(url: string) => void>('OPEN_WALLET', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return (url: string) => view?.location.assign(url);
  },
});
