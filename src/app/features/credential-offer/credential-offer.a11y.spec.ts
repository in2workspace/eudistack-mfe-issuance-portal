import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CredentialOfferComponent } from './credential-offer.component';
import { CredentialOfferService, CredentialOfferStatus } from './credential-offer.service';
import { IssuanceStateService } from '../../core/services/issuance-state.service';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';

expect.extend(toHaveNoViolations);

// Ver comentario en credential-offer.component.spec.ts: `qrcode` hace E/S real (zlib),
// se mockea para no depender de su latencia real en test.
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mocked') },
}));

describe('CredentialOfferComponent a11y (AC-08, WCAG 2.1 AA)', () => {
  let fixture: ComponentFixture<CredentialOfferComponent>;

  const user = { name: 'Dra. García', email: 'a@b.com', collegiateNumber: '123', dni: '12345678A' };

  function configure(
    initialStatus: CredentialOfferStatus,
    initialUrl: { url: string; length: number } | null = null,
  ): void {
    TestBed.configureTestingModule({
      imports: [CredentialOfferComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: CredentialOfferService,
          useValue: {
            request: jest.fn(),
            retry: jest.fn(),
            cancelPendingWork: jest.fn(),
            status: signal(initialStatus),
            offer: signal(null),
            walletInvocationUrl: signal(initialUrl),
            cannotContinueReason: signal(initialStatus === 'unavailable' ? CannotContinueReason.OfferUnavailable : null),
          },
        },
        { provide: IssuanceStateService, useValue: { authenticatedUser: () => user } },
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(CredentialOfferComponent);
    fixture.detectChanges();
  }

  it('estado "loading" no tiene violaciones estructurales', async () => {
    configure('loading');

    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });

  it('estado "ready" no tiene violaciones — QR con alternativa textual, enlace con nombre accesible', async () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });
    // La generación del QR es asíncrona (efecto → promesa `QRCode.toDataURL`) — esperar antes de comprobar el DOM.
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const img = compiled.querySelector('img[width="280"]');
    const link = compiled.querySelector('a[href]');
    expect(img?.getAttribute('alt')?.trim().length).toBeGreaterThan(0);
    expect(link?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });

  it('estado "ready-without-qr" no tiene violaciones', async () => {
    configure('ready-without-qr', { url: 'https://o.example/w?credential_offer_uri=' + 'x'.repeat(1200), length: 1250 });

    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });

  it('estado "unavailable" no tiene violaciones — aviso anunciado con role="alert"', async () => {
    configure('unavailable');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')).not.toBeNull();
    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });
});
