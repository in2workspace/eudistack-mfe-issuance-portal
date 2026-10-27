import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TenantBranding } from './tenant-branding.model';

/** Idioma sin región, en minúsculas: `en-GB` → `en`. */
function primarySubtag(lang: string): string {
  return lang.trim().toLowerCase().split('-')[0];
}

/**
 * Idioma del portal (prd.md FR-02, design.md AD-4), con los idiomas del
 * `theme.json` del tenant. El inicial es el primero del navegador que el
 * tenant ofrece, comparando sin región (EC-02); si no ofrece ninguno, su
 * idioma por defecto (AC-03), o el primero de su lista si ese no está en
 * ella. El titular solo puede cambiar entre los idiomas del tenant.
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
    const fallback = supported.includes(branding.defaultLanguage) ? branding.defaultLanguage : supported[0];
    // Respaldo de las claves que falten en el idioma activo.
    this.translate.setDefaultLang(fallback);
    this.use(this.browserLanguage(supported, browserLanguages) ?? fallback);
  }

  /**
   * Vuelve a cargar los textos del idioma activo, para mezclar los del tenant
   * cuando `GET /config` responde después del arranque.
   */
  reloadTexts(): void {
    const lang = this._current();
    if (lang) {
      this.translate.reloadLang(lang).subscribe(() => this.translate.use(lang));
    }
  }

  /** Cambia de idioma sin recargar. Un idioma que el tenant no ofrece se ignora. */
  use(lang: string): void {
    if (!this._supported().includes(lang)) {
      return;
    }
    this._current.set(lang);
    this.translate.use(lang);
  }

  private browserLanguage(supported: readonly string[], browserLanguages: readonly string[]): string | undefined {
    for (const browserLanguage of browserLanguages) {
      const match = supported.find((lang) => primarySubtag(lang) === primarySubtag(browserLanguage));
      if (match) {
        return match;
      }
    }
    return undefined;
  }
}
