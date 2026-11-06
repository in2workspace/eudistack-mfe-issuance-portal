import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import QRCode from 'qrcode';
import { CredentialOfferService, MAX_QR_PAYLOAD_CHARS } from './credential-offer.service';
import { OfferFlowService } from './offer-flow.service';
import { formatCountdown } from './credential-offer-expiry';
import { CredentialOfferUrlBoxComponent } from '../../shared/components/credential-offer-url-box/credential-offer-url-box.component';

/**
 * Paso QR (wireframes, QR; design.md §3.3). Estados de
 * `CredentialOfferService.status()`: generando, listo, sin QR (la dirección
 * supera el límite del QR) y caducado (QR atenuado y «Generar un código
 * nuevo»). La cuenta atrás va hasta la caducidad que da el servicio. La
 * oferta la pide `OfferFlowService` al entrar. La ruta la protege
 * `journeyStepGuard`.
 */
@Component({
  selector: 'app-credential-offer',
  imports: [TranslateModule, CredentialOfferUrlBoxComponent],
  providers: [OfferFlowService],
  templateUrl: './credential-offer.component.html',
})
export class CredentialOfferComponent implements OnInit, OnDestroy {
  private readonly service = inject(CredentialOfferService);
  private readonly flow = inject(OfferFlowService);
  private readonly router = inject(Router);

  protected readonly status = this.service.status;
  protected readonly address = computed(() => this.service.address()?.url ?? null);
  protected readonly countdown = computed(() => formatCountdown(this.service.remainingSeconds()));
  protected readonly qrDataUrl = signal<string | null>(null);
  /** El QR no se ha podido generar: se muestran el botón y el enlace igualmente (ac.md AC-05). */
  protected readonly qrFailed = signal(false);
  protected readonly withoutQr = computed(() => this.status() === 'ready-without-qr' || this.qrFailed());

  constructor() {
    // El QR se genera para cada dirección que cabe en él, y se conserva
    // (atenuado) cuando caduca.
    effect(() => {
      const url = this.address();
      this.qrDataUrl.set(null);
      this.qrFailed.set(false);
      if (url && url.length <= MAX_QR_PAYLOAD_CHARS) {
        QRCode.toDataURL(url, { width: 280, errorCorrectionLevel: 'H', margin: 2 }).then(
          (dataUrl) => this.qrDataUrl.set(dataUrl),
          () => this.qrFailed.set(true),
        );
      }
    });
  }

  ngOnInit(): void {
    void this.flow.enter();
  }

  ngOnDestroy(): void {
    this.service.cancelPendingWork();
  }

  onNewCode(): void {
    void this.flow.newCode();
  }

  onComplete(): void {
    void this.router.navigate(['/']);
  }

  onCancel(): void {
    void this.router.navigate(['/']);
  }
}
