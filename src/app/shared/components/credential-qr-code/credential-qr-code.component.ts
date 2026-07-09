import { Component, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';

interface CredentialQRPayload {
  protocol: 'cgcom-wallet';
  action: 'issue';
  credentialId: string;
  credentialType: string;
  userId: string;
  name: string;
  collegiateNumber: string;
  college: string;
  specialty: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

/**
 * Genera y muestra un QR con el payload de emisión CGCOM (JSON firmado).
 *
 * Equivalente a CredentialQRCode.tsx (React).
 * Usa el paquete `qrcode` para generar una data URL que se renderiza como <img>.
 * El payload se construye una sola vez en ngOnInit.
 */
@Component({
  selector: 'app-credential-qr-code',
  imports: [CommonModule],
  template: `
    @if (qrDataUrl()) {
      <img [src]="qrDataUrl()" [width]="size()" [height]="size()" alt="Código QR de la credencial" />
    }
  `,
})
export class CredentialQrCodeComponent implements OnInit {
  readonly credentialId = input.required<string>();
  readonly credentialType = input.required<string>();
  readonly userId = input.required<string>();
  readonly name = input.required<string>();
  readonly collegiateNumber = input.required<string>();
  readonly college = input.required<string>();
  readonly specialty = input.required<string>();
  readonly size = input<number>(280);

  readonly qrDataUrl = signal<string | null>(null);

  ngOnInit(): void {
    const qrValue = this.buildQRPayload();
    QRCode.toDataURL(qrValue, {
      width: this.size(),
      errorCorrectionLevel: 'H',
      margin: 2,
    }).then((url) => this.qrDataUrl.set(url));
  }

  private buildQRPayload(): string {
    const now = Date.now();
    const ttlMs = 10 * 60 * 1000; // 10 minutos

    const payload: CredentialQRPayload = {
      protocol: 'cgcom-wallet',
      action: 'issue',
      credentialId: this.credentialId(),
      credentialType: this.credentialType(),
      userId: this.userId(),
      name: this.name(),
      collegiateNumber: this.collegiateNumber(),
      college: this.college(),
      specialty: this.specialty(),
      issuedAt: now,
      expiresAt: now + ttlMs,
      nonce: this.generateNonce(),
    };
    return JSON.stringify(payload);
  }

  private generateNonce(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
