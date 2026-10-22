import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import QRCode from 'qrcode';
import { CredentialOfferService } from './credential-offer.service';
import { BrandingService } from '../../core/branding/branding.service';
import { CredentialOfferUrlBoxComponent } from '../../shared/components/credential-offer-url-box/credential-offer-url-box.component';
import { CREDENTIAL_OFFER_PRESENTATION_TTL_MS } from './credential-offer-expiry';

/**
 * Pantalla de presentación de la oferta de credencial (EUD-163).
 *
 * Cuatro estados (`CredentialOfferService.status()`): `loading` (AC-04),
 * `ready` (AC-01/AC-02), `ready-without-qr` (ES-06) y `unavailable`
 * (AC-05, reutiliza el patrón visual + claves `issuanceEntryPoint.cannotContinue.*`
 * ya existentes en el catálogo, igual que `IssuanceInfoComponent`).
 *
 * La interfaz ya no guarda los datos del titular (design.md AD-3), así que no
 * tiene nada que enviar para pedir la oferta: al entrar o reintentar vuelve a
 * Inicio hasta que la oferta se pida al servicio del portal con
 * `POST /journey/confirmation` (EUD-286). La ruta la protege
 * `pendingJourneyGuard` mientras tanto.
 */
@Component({
  selector: 'app-credential-offer',
  imports: [TranslateModule, CredentialOfferUrlBoxComponent],
  templateUrl: './credential-offer.component.html',
})
export class CredentialOfferComponent implements OnInit, OnDestroy {
  private readonly service = inject(CredentialOfferService);
  private readonly router = inject(Router);
  protected readonly branding = inject(BrandingService);

  protected readonly status = this.service.status;
  protected readonly cannotContinueReason = this.service.cannotContinueReason;
  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly walletInvocationUrlValue = computed(() => this.service.walletInvocationUrl()?.url ?? null);
  /** Minutos de la ventana de presentación real (AD-6/NFR-S-163-01) — el aviso de validez refleja el TTL de código, no un texto decorativo independiente. */
  protected readonly validityMinutes = CREDENTIAL_OFFER_PRESENTATION_TTL_MS / 60_000;

  constructor() {
    // Genera el QR solo en 'ready' (no en 'ready-without-qr', ES-06) —
    // efecto reactivo a la URL de invocación, no a un ngOnInit puntual,
    // para que un retry() con oferta nueva regenere el QR.
    effect(() => {
      const status = this.status();
      const url = this.service.walletInvocationUrl();
      if (status === 'ready' && url) {
        QRCode.toDataURL(url.url, { width: 280, errorCorrectionLevel: 'H', margin: 2 }).then((dataUrl) => {
          this.qrDataUrl.set(dataUrl);
        });
      } else {
        this.qrDataUrl.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.service.cancelPendingWork();
  }

  onRetry(): void {
    this.router.navigate(['/']);
  }

  onComplete(): void {
    this.router.navigate(['/']);
  }

  onCancel(): void {
    this.router.navigate(['/']);
  }
}
