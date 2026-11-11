import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import QRCode from 'qrcode';
import { CredentialOfferService, MAX_QR_PAYLOAD_CHARS } from './credential-offer.service';
import { OfferFlowService } from './offer-flow.service';
import { formatCountdown } from './credential-offer-expiry';
import { MobileLayout, OPEN_WALLET } from '../../core/layout/mobile-layout';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CredentialOfferUrlBoxComponent } from '../../shared/components/credential-offer-url-box/credential-offer-url-box.component';

/**
 * Paso QR (wireframes, QR; design.md §3.3 y AD-5). Estados de
 * `CredentialOfferService.status()`: generando, listo, sin QR y caducado (QR
 * atenuado y «Generar un código nuevo»). La cuenta atrás va hasta la
 * caducidad que da el servicio. La oferta la pide `OfferFlowService` al
 * entrar. La ruta la protege `journeyStepGuard`.
 *
 * En el móvil, abrir el wallet es la acción principal y va antes del QR, sin
 * aviso. En el ordenador, el QR es la acción principal y abrir el wallet es
 * un enlace secundario que antes muestra el aviso de ordenador personal; sin
 * QR, pasa a ser el botón principal con el mismo aviso (prd.md FR-07).
 */
@Component({
  selector: 'app-credential-offer',
  imports: [NgTemplateOutlet, TranslateModule, CredentialOfferUrlBoxComponent, ConfirmDialogComponent],
  providers: [OfferFlowService],
  templateUrl: './credential-offer.component.html',
})
export class CredentialOfferComponent implements OnInit, OnDestroy {
  private readonly service = inject(CredentialOfferService);
  private readonly flow = inject(OfferFlowService);
  private readonly openWallet = inject(OPEN_WALLET);

  protected readonly mobile = inject(MobileLayout).mobile;
  protected readonly status = this.service.status;
  protected readonly address = computed(() => this.service.address()?.url ?? null);
  protected readonly countdown = computed(() => formatCountdown(this.service.remainingSeconds()));
  protected readonly qrDataUrl = signal<string | null>(null);
  /** El QR no se ha podido generar: se muestran el botón y el enlace igualmente (ac.md AC-05). */
  protected readonly qrFailed = signal(false);
  protected readonly withoutQr = computed(() => this.status() === 'ready-without-qr' || this.qrFailed());
  protected readonly personalComputerNoticeOpen = signal(false);
  protected readonly finishing = signal(false);

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
    this.service.reset();
  }

  onNewCode(): void {
    void this.flow.newCode();
  }

  /** En el ordenador, abrir el wallet pasa antes por el aviso de ordenador personal (ac.md AC-14). */
  onUseThisComputer(): void {
    this.personalComputerNoticeOpen.set(true);
  }

  onUseMobile(): void {
    this.personalComputerNoticeOpen.set(false);
  }

  onContinueOnThisComputer(): void {
    this.personalComputerNoticeOpen.set(false);
    const url = this.address();
    if (url) {
      this.openWallet(url);
    }
  }

  onFinish(): void {
    if (this.finishing()) {
      return;
    }
    this.finishing.set(true);
    void this.flow.finish().finally(() => this.finishing.set(false));
  }
}
