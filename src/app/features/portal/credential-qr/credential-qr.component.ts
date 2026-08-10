import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { CredentialOfferUrlBoxComponent } from '../../../shared/components/credential-offer-url-box/credential-offer-url-box.component';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';

/** Único tenant con emisión DoctorID hoy; el resto emite una credencial genérica de empleado (mismo criterio que UserDataComponent). */
function resolveCredentialLabel(): string {
  return resolveTenantIdentity(window.location, environment) === 'cgcom' ? 'DoctorID' : 'EmployeeID';
}

/**
 * Muestra el QR real generado a partir de la Credential Offer URL del issuer.
 *
 * Equivalente a CredentialQRPage.tsx (React).
 * RF-002: QR real clickable que abre la wallet web.
 * RF-003: caja con URL y botón de copia (delegado a CredentialOfferUrlBoxComponent).
 * FA-001 de RF-002: si credentialOfferUrl es null → alert de error + opción de reintento.
 */
@Component({
  selector: 'app-credential-qr',
  imports: [CommonModule, CredentialOfferUrlBoxComponent],
  templateUrl: './credential-qr.component.html',
})
export class CredentialQrComponent implements OnInit {
  private state = inject(IssuanceStateService);
  private router = inject(Router);
  protected readonly branding = inject(BrandingService);

  readonly credentialOfferUrl = this.state.credentialOfferUrl;
  readonly qrDataUrl = signal<string | null>(null);
  walletUrl: string | null = null;

  protected readonly credentialLabel = resolveCredentialLabel();

  ngOnInit(): void {
    const offerUrl = this.credentialOfferUrl();
    if (offerUrl) {
      this.walletUrl = this.buildWalletUrl(offerUrl);
      QRCode.toDataURL(this.walletUrl, { width: 280, errorCorrectionLevel: 'H', margin: 2 }).then(
        (url) => this.qrDataUrl.set(url),
      );
    }
  }

  onComplete(): void {
    // No hay otra pantalla "home" real en issuance-portal — /portal/success
    // y /portal/home se retiraron (movidos/duplicados en otro sitio).
    this.router.navigate(['/portal']);
  }

  onCancel(): void {
    this.state.clearUser();
    this.router.navigate(['/portal']);
  }

  onRetry(): void {
    this.state.setCredentialOfferUrl('');
    this.state.setBootstrapError(null);
    this.router.navigate(['/portal/user-data']);
  }

  /**
   * Construye la URL del wallet web a partir de la Credential Offer URL del issuer.
   * Extrae el param `credential_offer_uri` y lo recompone como URL de callback.
   *
   * URL absoluta same-origin (AD-2): el QR lo escanea un dispositivo externo
   * (sin contexto de página), así que no vale una ruta relativa — pero se
   * construye desde `window.location.origin` en vez de un host cgcom fijo,
   * ya que nginx sirve `/wallet/` igual bajo cualquier subdominio de tenant
   * (bug R-5).
   */
  private buildWalletUrl(credentialOfferUrl: string): string {
    const base = `${window.location.origin}/wallet/protocol/callback`;
    try {
      const parsed = new URL(credentialOfferUrl);
      const credentialOfferUri = parsed.searchParams.get('credential_offer_uri');
      if (credentialOfferUri) {
        return `${base}?credential_offer_uri=${encodeURIComponent(credentialOfferUri)}`;
      }
    } catch {
      // URL no parseable — usar la URL completa como parámetro
    }
    return `${base}?credential_offer_uri=${encodeURIComponent(credentialOfferUrl)}`;
  }
}
