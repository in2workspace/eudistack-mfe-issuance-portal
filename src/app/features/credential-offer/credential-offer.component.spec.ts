import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CredentialOfferComponent } from './credential-offer.component';
import { CredentialOfferService, CredentialOfferStatus } from './credential-offer.service';
import { IssuanceStateService } from '../../core/services/issuance-state.service';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';

// `qrcode` hace codificación PNG real (zlib) con latencia de E/S real — no es una
// promesa "de microtarea pura", así que ni `fakeAsync`/`tick()` ni `whenStable()`
// la resuelven de forma fiable en test. Se mockea para aislar la UI de la librería
// externa (su propio comportamiento ya está cubierto por los tests del paquete).
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mocked') },
}));

describe('CredentialOfferComponent', () => {
  let fixture: ComponentFixture<CredentialOfferComponent>;
  let status: ReturnType<typeof signal<CredentialOfferStatus>>;
  let walletInvocationUrl: ReturnType<typeof signal<{ url: string; length: number } | null>>;
  let cannotContinueReason: ReturnType<typeof signal<CannotContinueReason | null>>;
  let serviceMock: { request: jest.Mock; retry: jest.Mock; cancelPendingWork: jest.Mock };
  let stateMock: { authenticatedUser: () => typeof user | null; clearUser: jest.Mock };

  const user = { name: 'Dra. García', email: 'a@b.com', collegiateNumber: '123', dni: '12345678A' };

  function configure(initialStatus: CredentialOfferStatus, initialUrl: { url: string; length: number } | null = null): void {
    status = signal(initialStatus);
    walletInvocationUrl = signal(initialUrl);
    cannotContinueReason = signal(initialStatus === 'unavailable' ? CannotContinueReason.OfferUnavailable : null);
    serviceMock = { request: jest.fn(), retry: jest.fn(), cancelPendingWork: jest.fn() };
    stateMock = { authenticatedUser: () => user, clearUser: jest.fn() };

    TestBed.configureTestingModule({
      imports: [CredentialOfferComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: CredentialOfferService,
          useValue: { ...serviceMock, status, offer: signal(null), walletInvocationUrl, cannotContinueReason },
        },
        { provide: IssuanceStateService, useValue: stateMock },
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(CredentialOfferComponent);
    fixture.detectChanges();
  }

  it('AC-04: estado de espera explícito antes de la respuesta, sin pantalla en blanco', () => {
    configure('loading');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="status"]')).not.toBeNull();
    expect(compiled.textContent).not.toBe('');
  });

  it('AC-01: QR y enlace visibles a la vez en la misma pantalla al llegar la oferta', async () => {
    configure('ready', { url: 'https://origin.example/wallet/protocol/callback?credential_offer_uri=ref', length: 60 });
    // La generación del QR (`QRCode.toDataURL`, mockeada arriba) es asíncrona (efecto → promesa) —
    // hay que dejar que el microtask resuelva y reflejarlo con un segundo detectChanges.
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('img[width="280"]')).not.toBeNull();
    const link = compiled.querySelector('a[href]');
    expect(link?.getAttribute('href')).toBe('https://origin.example/wallet/protocol/callback?credential_offer_uri=ref');
  });

  it('AC-05: aviso genérico con opción de reintentar, sin causa técnica ni identificador interno', () => {
    configure('unavailable');

    const compiled = fixture.nativeElement as HTMLElement;
    const alert = compiled.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    // `TranslateModule.forRoot()` sin loader en test no resuelve el catálogo real
    // (devuelve la clave i18n tal cual, no el texto en español) — se comprueba
    // aquí que NUNCA se filtra un detalle técnico real (status HTTP, cuerpo de
    // la respuesta), no el nombre de la clave de traducción en sí.
    expect(alert?.textContent).not.toMatch(/\b[45]\d{2}\b|Http|status:|body:/i);

    const retryButton = compiled.querySelector('button');
    retryButton?.dispatchEvent(new Event('click'));
    expect(serviceMock.retry).toHaveBeenCalledWith(expect.objectContaining({ name: user.name }));
  });

  it('AC-09: el enlace y el título usan el pipe de traducción (nunca un literal hardcodeado en el template)', () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });

    // `TranslateModule.forRoot()` sin loader en test devuelve la clave i18n tal
    // cual — comprobar ESO (no un texto en español) es justo la evidencia de
    // que el template pasa por `| translate` y no por un string hardcodeado.
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href]');
    expect(link?.textContent?.trim()).toBe('credentialOffer.deeplink.label');
  });

  it('EC-01: sin app que atienda el enlace, la pantalla no cambia — QR y enlace siguen disponibles', async () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });
    // Ídem AC-01: esperar a que la promesa mockeada de `QRCode.toDataURL` resuelva antes de comprobar el QR.
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href]') as HTMLAnchorElement;
    // Un <a href> normal: si nada lo atiende, el navegador no notifica a la SPA — no hay handler que reaccionar.
    expect(link.onclick).toBeNull();
    // target="_blank" (+ rel="noopener noreferrer"): el enlace abre en una
    // pestaña nueva para que la pantalla de la oferta (QR + enlace + URL box)
    // siga visible en la pestaña original, tanto si walletInvocationBase es
    // una ruta same-origin (navega en la misma pestaña sin esto) como si es
    // el esquema openid-credential-offer:// (delegado al SO en cualquier caso).
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(compiled.querySelector('img[width="280"]')).not.toBeNull();
    expect(compiled.querySelector('app-credential-offer-url-box')).not.toBeNull();
  });

  it("ES-06: con status 'ready-without-qr' se presenta el enlace y la URL, sin QR", () => {
    configure('ready-without-qr', { url: 'https://o.example/w?credential_offer_uri=' + 'x'.repeat(1200), length: 1250 });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('img[width="280"]')).toBeNull();
    expect(compiled.querySelector('a[href]')).not.toBeNull();
    expect(compiled.querySelector('app-credential-offer-url-box')).not.toBeNull();
  });

  it('presenta el aviso de validez (10 min, AD-6/NFR-S-163-01) junto al QR y enlace', () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });

    const compiled = fixture.nativeElement as HTMLElement;
    const notice = compiled.querySelector('[role="status"]');
    expect(notice?.textContent).toContain('credentialOffer.validity.notice');
  });

  it('Cancelar limpia el usuario autenticado y vuelve al origen/raíz (recuperado del material demo, AD-5)', () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const cancelButton = buttons.find((b) => b.textContent?.includes('credentialOffer.actions.cancel'));
    cancelButton?.dispatchEvent(new Event('click'));

    expect(stateMock.clearUser).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('Marcar como completado vuelve al origen/raíz sin limpiar el usuario (recuperado del material demo, AD-5)', () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const completeButton = buttons.find((b) => b.textContent?.includes('credentialOffer.actions.complete'));
    completeButton?.dispatchEvent(new Event('click'));

    expect(stateMock.clearUser).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('ngOnDestroy cancela el trabajo pendiente del service (temporizador de caducidad)', () => {
    configure('ready', { url: 'https://o.example/w?credential_offer_uri=r', length: 40 });

    fixture.destroy();

    expect(serviceMock.cancelPendingWork).toHaveBeenCalled();
  });

  it('sin usuario autenticado, redirige a la raíz en vez de solicitar la oferta', () => {
    status = signal('idle');
    walletInvocationUrl = signal(null);
    cannotContinueReason = signal(null);
    serviceMock = { request: jest.fn(), retry: jest.fn(), cancelPendingWork: jest.fn() };

    TestBed.configureTestingModule({
      imports: [CredentialOfferComponent, TranslateModule.forRoot()],
      providers: [
        { provide: CredentialOfferService, useValue: { ...serviceMock, status, offer: signal(null), walletInvocationUrl, cannotContinueReason } },
        { provide: IssuanceStateService, useValue: { authenticatedUser: () => null } },
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(CredentialOfferComponent);
    fixture.detectChanges();

    expect(serviceMock.request).not.toHaveBeenCalled();
  });
});
