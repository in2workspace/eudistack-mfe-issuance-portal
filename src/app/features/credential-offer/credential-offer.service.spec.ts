import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CredentialOfferService } from './credential-offer.service';
import { CredentialOfferSource } from './credential-offer.source';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { CredentialOfferResult } from './credential-offer.model';

describe('CredentialOfferService', () => {
  let service: CredentialOfferService;
  let source: { fetch: jest.Mock };
  let configSource: { read: jest.Mock };
  let sessionStore: { read: jest.Mock };
  let fetch$: Subject<CredentialOfferResult>;

  const context = { name: 'Dra. García', email: 'a@b.com', collegiateNumber: '123', dni: '12345678A' };
  const validConfig = { credentialOfferUrl: '/issuance-portal/api/bootstrap', credentialOfferLinkBase: '/wallet/protocol/callback' };

  beforeEach(() => {
    fetch$ = new Subject();
    source = { fetch: jest.fn(() => fetch$.asObservable()) };
    configSource = { read: jest.fn(() => validConfig) };
    sessionStore = { read: jest.fn(() => ({ id: 'sess-1', tenant: 'cgcom', state: 'iniciada' })) };

    TestBed.configureTestingModule({
      providers: [
        CredentialOfferService,
        { provide: CredentialOfferSource, useValue: source },
        { provide: TenantPortalConfigSource, useValue: configSource },
        { provide: IssuanceStartSessionStore, useValue: sessionStore },
      ],
    });
    service = TestBed.inject(CredentialOfferService);
  });

  it('AC-04: pasa a loading al solicitar, y a ready cuando llega la oferta (AC-01)', () => {
    service.request(context);
    expect(service.status()).toBe('loading');

    fetch$.next({ ok: true, offer: { reference: 'https://issuer.example/o/1', obtainedAt: Date.now() } });

    expect(service.status()).toBe('ready');
    expect(service.walletInvocationUrl()?.url).toContain('credential_offer_uri=');
  });

  it('EC-02: doble activación antes de la respuesta no emite una segunda solicitud (guard single-flight)', () => {
    service.request(context);
    service.request(context);

    expect(source.fetch).toHaveBeenCalledTimes(1);
  });

  it('AC-07: con una oferta ya presentada, un segundo acceso no solicita otra ni la sustituye', () => {
    service.request(context);
    fetch$.next({ ok: true, offer: { reference: 'ref', obtainedAt: Date.now() } });

    service.request(context);

    expect(source.fetch).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('ready');
  });

  it('AC-06: retry() solicita una oferta nueva y la presenta si llega', () => {
    service.request(context);
    fetch$.next({ ok: false, reason: 'issuance_error' });
    expect(service.status()).toBe('unavailable');

    const fetch2$ = new Subject<CredentialOfferResult>();
    source.fetch.mockReturnValueOnce(fetch2$.asObservable());
    service.retry(context);
    expect(service.status()).toBe('loading');

    fetch2$.next({ ok: true, offer: { reference: 'ref-2', obtainedAt: Date.now() } });
    expect(service.status()).toBe('ready');
  });

  it('AC-06: si el reintento vuelve a fallar, se muestra de nuevo el aviso', () => {
    service.request(context);
    fetch$.next({ ok: false, reason: 'timeout' });
    expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferTimeout);

    const fetch2$ = new Subject<CredentialOfferResult>();
    source.fetch.mockReturnValueOnce(fetch2$.asObservable());
    service.retry(context);
    fetch2$.next({ ok: false, reason: 'issuance_error' });

    expect(service.status()).toBe('unavailable');
    expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferUnavailable);
  });

  it('EC-03: la respuesta del adapter mapea timeout a CannotContinueReason.OfferTimeout, el resto a OfferUnavailable', () => {
    service.request(context);
    fetch$.next({ ok: false, reason: 'malformed' });

    expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferUnavailable);
  });

  it('EC-04: sin sesión, la solicitud se identifica por tenant y AC-07 sigue aplicando', () => {
    sessionStore.read.mockReturnValue(null);

    service.request(context);
    fetch$.next({ ok: true, offer: { reference: 'ref', obtainedAt: Date.now() } });
    service.request(context);

    expect(source.fetch).toHaveBeenCalledTimes(1);
  });

  it('ES-02: config ausente no realiza ninguna llamada de red', () => {
    configSource.read.mockReturnValue(null);

    service.request(context);

    expect(source.fetch).not.toHaveBeenCalled();
    expect(service.status()).toBe('unavailable');
    expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferUnavailable);
  });

  it('NFR-S-163-03: nunca escribe la referencia en sessionStorage/localStorage ni en consola', () => {
    const storageSpy = jest.spyOn(Storage.prototype, 'setItem');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    service.request(context);
    fetch$.next({ ok: true, offer: { reference: 'super-secret-reference', obtainedAt: Date.now() } });

    const storageLeaks = storageSpy.mock.calls.filter(([, value]) => String(value).includes('super-secret-reference'));
    const consoleLeaks = consoleSpy.mock.calls.filter((args) => args.some((a) => String(a).includes('super-secret-reference')));

    expect(storageLeaks).toHaveLength(0);
    expect(consoleLeaks).toHaveLength(0);

    storageSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('retry() tras un éxito previo también descarta la oferta memoizada y pide una nueva', () => {
    service.request(context);
    fetch$.next({ ok: true, offer: { reference: 'ref-1', obtainedAt: Date.now() } });

    const fetch2$ = new Subject<CredentialOfferResult>();
    source.fetch.mockReturnValueOnce(fetch2$.asObservable());
    service.retry(context);

    expect(service.status()).toBe('loading');
    expect(source.fetch).toHaveBeenCalledTimes(2);
  });
});
