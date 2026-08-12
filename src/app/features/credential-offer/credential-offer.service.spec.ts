import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
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

  // Relabeled (auditoría EUD-163, hallazgo W3): esto prueba el mapeo de
  // razones de fallo, no el escenario EC-03 ("respuesta que llega justo
  // antes de vencer el plazo") — esa evidencia real vive en
  // credential-offer.source.spec.ts ("a 14999 ms la respuesta resuelve
  // normalmente", etiquetado NFR-P-163-01).
  it('mapea "malformed"/otras razones a OfferUnavailable — solo "timeout" mapea a OfferTimeout (ver EC-03 real en credential-offer.source.spec.ts)', () => {
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

  // Auditoría de código EUD-163 (code-reviewer, hallazgo B1): el temporizador
  // de caducidad real (armExpiryTimer/cancelPendingWork/guard W-2) no tenía
  // ningún test que lo ejerciera de verdad — solo se probaba la función pura
  // `isCredentialOfferExpired`, que además nunca se llamaba desde producción.
  describe('temporizador de caducidad real (ES-03, NFR-S-163-01, B1)', () => {
    it('a los 601 s (pasado el límite de 10 min), retira la oferta y muestra el aviso de indisponibilidad', fakeAsync(() => {
      service.request(context);
      fetch$.next({ ok: true, offer: { reference: 'ref-1', obtainedAt: Date.now() } });
      expect(service.status()).toBe('ready');

      tick(601 * 1000);

      // La UI oculta QR/enlace por `status()` (credential-offer.component.html
      // solo los renderiza en 'ready'/'ready-without-qr'), no por el valor de
      // offer()/walletInvocationUrl() — retención interna de esos signals tras
      // fail() es el hallazgo F10 (LOW, auditoría EUD-163), fuera de alcance aquí.
      expect(service.status()).toBe('unavailable');
      expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferUnavailable);
    }));

    it('a los 599 s todavía no ha caducado — la oferta sigue presentada', fakeAsync(() => {
      service.request(context);
      fetch$.next({ ok: true, offer: { reference: 'ref-1', obtainedAt: Date.now() } });

      tick(599 * 1000);

      expect(service.status()).toBe('ready');
      discardPeriodicTasks();
    }));

    it('cancelPendingWork() cancela el temporizador pendiente — no caduca tras destruir el componente', fakeAsync(() => {
      service.request(context);
      fetch$.next({ ok: true, offer: { reference: 'ref-1', obtainedAt: Date.now() } });

      service.cancelPendingWork();
      tick(601 * 1000);

      // Sin el temporizador cancelado, esto habría pasado a 'unavailable' (ver test anterior).
      expect(service.status()).toBe('ready');
    }));

    it('retry() antes de que expire descarta el temporizador anterior — no dispara el fail() viejo', fakeAsync(() => {
      service.request(context);
      fetch$.next({ ok: true, offer: { reference: 'ref-1', obtainedAt: Date.now() } });

      tick(5 * 60 * 1000); // a media ventana

      const fetch2$ = new Subject<CredentialOfferResult>();
      source.fetch.mockReturnValueOnce(fetch2$.asObservable());
      service.retry(context);
      fetch2$.next({ ok: true, offer: { reference: 'ref-2', obtainedAt: Date.now() } });
      expect(service.status()).toBe('ready');

      // Si el temporizador viejo (armado a los 10 min de ref-1, ya a punto de
      // disparar) no se hubiera cancelado en retry(), esto lo dispararía.
      tick(5 * 60 * 1000 + 1000);

      expect(service.status()).toBe('ready');
      expect(service.offer()?.reference).toBe('ref-2');
      discardPeriodicTasks();
    }));

    it('W-2: una respuesta tardía de una petición ya descartada por retry() no sobreescribe el estado de la nueva', fakeAsync(() => {
      service.request(context);
      // No se resuelve fetch$ todavía — la primera petición queda en vuelo.

      const fetch2$ = new Subject<CredentialOfferResult>();
      source.fetch.mockReturnValueOnce(fetch2$.asObservable());
      service.retry(context);
      fetch2$.next({ ok: true, offer: { reference: 'ref-nueva', obtainedAt: Date.now() } });
      expect(service.status()).toBe('ready');
      expect(service.offer()?.reference).toBe('ref-nueva');

      // La petición vieja (fetch$, todavía suscrita) responde tarde — debe descartarse (requestId ya no coincide).
      fetch$.next({ ok: true, offer: { reference: 'ref-vieja-tardía', obtainedAt: Date.now() } });

      expect(service.offer()?.reference).toBe('ref-nueva');
      discardPeriodicTasks();
    }));
  });
});
