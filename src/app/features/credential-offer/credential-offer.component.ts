import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import QRCode from 'qrcode';
import { CredentialOfferService } from './credential-offer.service';
import { CredentialOfferRequestContext } from './credential-offer.source';
import { IssuanceStateService } from '../../core/services/issuance-state.service';
import { BrandingService } from '../../core/branding/branding.service';
import { CredentialOfferUrlBoxComponent } from '../../shared/components/credential-offer-url-box/credential-offer-url-box.component';

/**
 * Pantalla de presentación de la oferta de credencial (EUD-163).
 *
 * Cuatro estados (`CredentialOfferService.status()`): `loading` (AC-04),
 * `ready` (AC-01/AC-02), `ready-without-qr` (ES-06) y `unavailable`
 * (AC-05, reutiliza el patrón visual + claves `issuanceEntryPoint.cannotContinue.*`
 * ya existentes en el catálogo, igual que `IssuanceInfoComponent`).
 */
@Component({
  selector: 'app-credential-offer',
  imports: [TranslateModule, CredentialOfferUrlBoxComponent],
  templateUrl: './credential-offer.component.html',
})
export class CredentialOfferComponent implements OnInit, OnDestroy {
  private readonly state = inject(IssuanceStateService);
  private readonly service = inject(CredentialOfferService);
  private readonly router = inject(Router);
  protected readonly branding = inject(BrandingService);

  protected readonly status = this.service.status;
  protected readonly cannotContinueReason = this.service.cannotContinueReason;
  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly walletInvocationUrlValue = computed(() => this.service.walletInvocationUrl()?.url ?? null);

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
    const context = this.buildContext();
    if (!context) {
      this.router.navigate(['/']);
      return;
    }
    this.service.request(context);
  }

  ngOnDestroy(): void {
    this.service.cancelPendingWork();
  }

  onRetry(): void {
    const context = this.buildContext();
    if (!context) {
      this.router.navigate(['/']);
      return;
    }
    this.service.retry(context);
  }

  private buildContext(): CredentialOfferRequestContext | null {
    const user = this.state.authenticatedUser();
    if (!user) {
      return null;
    }
    return { name: user.name, email: user.email, collegiateNumber: user.collegiateNumber, dni: user.dni };
  }
}
