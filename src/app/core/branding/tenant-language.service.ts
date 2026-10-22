import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TenantBranding } from './tenant-branding.model';

/** Idioma sin región, en minúsculas: `en-GB` → `en`. */
function primarySubtag(lang: string): string {
  return lang.trim().toLowerCase().split('-')[0];
}

/**
 * Idioma del portal (prd.md FR-02, design.md AD-4). El inicial es el primero
 * del navegador que el tenant ofrece, comparando sin región (EC-02); si no
 * ofrece ninguno, el primero del tenant (AC-03). El titular solo puede cambiar
 * entre los idiomas del tenant.
 */
@Injectable({ providedIn: 'root' })
export class TenantLanguageService {
  private readonly translate = inject(TranslateService);
  private readonly _current = signal<string>('');
  private readonly _supported = signal<readonly string[]>([]);

  readonly current = this._current.asReadonly();
  readonly supported = this._supported.asReadonly();

  apply(branding: TenantBranding, browserLanguages: readonly string[] = navigator.languages ?? []): void {
    const supported = branding.supportedLanguages;
    this._supported.set(supported);
    this.translate.addLangs([...supported]);
    // Respaldo de las claves que falten en el idioma activo.
    this.translate.setDefaultLang(branding.defaultLanguage);
    this.use(this.initialLanguage(supported, browserLanguages) ?? branding.defaultLanguage);
  }

  /** Cambia de idioma sin recargar. Un idioma que el tenant no ofrece se ignora. */
  use(lang: string): void {
    if (!this._supported().includes(lang)) {
      return;
    }
    this._current.set(lang);
    this.translate.use(lang);
  }

  private initialLanguage(supported: readonly string[], browserLanguages: readonly string[]): string | undefined {
    for (const browserLanguage of browserLanguages) {
      const match = supported.find((lang) => primarySubtag(lang) === primarySubtag(browserLanguage));
      if (match) {
        return match;
      }
    }
    return supported[0];
  }
}
