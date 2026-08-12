import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Muestra la Credential Offer URL en un campo de solo lectura con botón de copia.
 *
 * Equivalente a CredentialOfferUrlBox.tsx (React).
 * RF-003: caja de texto readOnly + botón de copia al portapapeles.
 * RNF-004: usa Clipboard API asíncrona (Chrome 90+, Firefox 90+, Safari 14+).
 * FA-001 de RF-003 / EC-05 (EUD-163): si Clipboard API no está disponible,
 * falla silenciosamente — el campo readOnly sigue siendo seleccionable.
 * AC-09 (EUD-163): textos desde el catálogo i18n, color desde token de
 * branding (`brand-accent`), sin literales ni marca de tenant incrustados.
 */
@Component({
  selector: 'app-credential-offer-url-box',
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="w-full mt-4">
      <p class="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
        {{ 'credentialOffer.urlBox.label' | translate }}
      </p>
      <div class="flex items-center gap-2">
        <input
          type="text"
          readonly
          [value]="url()"
          class="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-md text-gray-700 select-all cursor-text focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent"
          [attr.aria-label]="'credentialOffer.urlBox.label' | translate"
        />
        <button
          type="button"
          (click)="handleCopy()"
          [attr.title]="(copied() ? 'credentialOffer.urlBox.copied' : 'credentialOffer.urlBox.copy') | translate"
          [attr.aria-label]="'credentialOffer.urlBox.copy' | translate"
          [class]="copyButtonClass()"
        >
          @if (copied()) {
            <!-- Check icon -->
            <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          } @else {
            <!-- Copy icon -->
            <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
        </button>
      </div>
      @if (copied()) {
        <p class="mt-1 text-xs text-green-600" role="status" aria-live="polite">
          {{ 'credentialOffer.urlBox.copiedAnnouncement' | translate }}
        </p>
      }
    </div>
  `,
})
export class CredentialOfferUrlBoxComponent {
  readonly url = input.required<string>();
  readonly copied = signal(false);

  copyButtonClass(): string {
    const base =
      'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md border transition-colors duration-150';
    return this.copied()
      ? `${base} border-green-500 bg-green-50 text-green-600`
      : `${base} border-gray-200 bg-white text-gray-500 hover:border-brand-accent hover:text-brand-accent hover:bg-brand-accent/5`;
  }

  async handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // FA-001 de RF-003 / EC-05: Clipboard API no disponible o permisos denegados.
      // El campo readOnly sigue siendo seleccionable para copia manual.
    }
  }
}
