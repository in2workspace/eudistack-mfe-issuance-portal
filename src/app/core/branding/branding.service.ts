import { Injectable, signal } from '@angular/core';
import { TenantBranding } from './tenant-branding.model';

/**
 * Aplica un `TenantBranding` ya resuelto al documento: CSS custom properties
 * en `:root` (AD-4), favicon y la señal del logo para la cabecera. El título
 * de la pestaña lo pone la cabecera con el nombre del portal traducido.
 * `apply()` siempre reescribe el estado completo — nunca lee ni mezcla con la
 * aplicación anterior — por eso es idempotente y no acumula branding de un
 * tenant previo (EC-05, R-2).
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly _logoUrl = signal<string>('');

  readonly logoUrl = this._logoUrl.asReadonly();

  apply(branding: TenantBranding): void {
    this.applyTokens(branding.tokens);
    this.setFavicon(branding.faviconUrl);
    this._logoUrl.set(branding.logoUrl);
  }

  private applyTokens(tokens: Record<string, string>): void {
    const root = document.documentElement;
    for (const [token, value] of Object.entries(tokens)) {
      root.style.setProperty(token, value);
    }
  }

  private setFavicon(href: string): void {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }
}
