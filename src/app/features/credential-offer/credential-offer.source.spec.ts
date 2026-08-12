import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CredentialOfferSource } from './credential-offer.source';
import { CredentialOfferResult } from './credential-offer.model';

describe('CredentialOfferSource', () => {
  let source: CredentialOfferSource;
  let httpMock: HttpTestingController;

  const config = { endpoint: '/issuance-portal/api/bootstrap', walletInvocationBase: '/wallet/protocol/callback' };
  const context = { name: 'Dra. García', email: 'a@b.com', collegiateNumber: '123', dni: '12345678A' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(CredentialOfferSource);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devuelve la referencia idéntica a la recibida, sin recorte ni re-encode (AC-03)', fakeAsync(() => {
    let emitted: CredentialOfferResult | undefined;
    const reference = 'https://issuer.example/credential-offer/abc123?x=1';

    source.fetch(config, context).subscribe((r) => (emitted = r));
    httpMock.expectOne(config.endpoint).flush({ credentialOfferUrl: reference });

    expect(emitted).toEqual({ ok: true, offer: { reference, obtainedAt: expect.any(Number) } });
  }));

  it('respuesta sin oferta utilizable (ausente) declara malformed sin presentar QR/enlace (ES-01)', fakeAsync(() => {
    let emitted: CredentialOfferResult | undefined;

    source.fetch(config, context).subscribe((r) => (emitted = r));
    httpMock.expectOne(config.endpoint).flush({});

    expect(emitted).toEqual({ ok: false, reason: 'malformed' });
  }));

  it('respuesta con una referencia de forma no admitida declara malformed (ES-01)', fakeAsync(() => {
    let emitted: CredentialOfferResult | undefined;

    source.fetch(config, context).subscribe((r) => (emitted = r));
    httpMock.expectOne(config.endpoint).flush({ credentialOfferUrl: 'not-a-valid-uri' });

    expect(emitted).toEqual({ ok: false, reason: 'malformed' });
  }));

  it('error explícito del proceso de emisión no propaga status, error ni body (ES-04, NFR-S-163-03)', fakeAsync(() => {
    let emitted: CredentialOfferResult | undefined;

    source.fetch(config, context).subscribe((r) => (emitted = r));
    httpMock.expectOne(config.endpoint).flush({ secret: 'internal detail' }, { status: 500, statusText: 'Server Error' });

    expect(emitted).toEqual({ ok: false, reason: 'issuance_error' });
    expect(JSON.stringify(emitted)).not.toContain('internal detail');
    expect(JSON.stringify(emitted)).not.toContain('500');
  }));

  it('a 14999 ms la respuesta resuelve normalmente (NFR-P-163-01)', fakeAsync(() => {
    let emitted: CredentialOfferResult | undefined;

    source.fetch(config, context).subscribe((r) => (emitted = r));
    tick(14_999);
    httpMock.expectOne(config.endpoint).flush({ credentialOfferUrl: 'https://issuer.example/offer/1' });

    expect(emitted).toEqual({ ok: true, offer: { reference: 'https://issuer.example/offer/1', obtainedAt: expect.any(Number) } });
  }));

  it('a 15001 ms declara timeout y cancela la petición en curso (ES-05, NFR-P-163-01)', fakeAsync(() => {
    let emitted: CredentialOfferResult | undefined;

    source.fetch(config, context).subscribe((r) => (emitted = r));
    httpMock.expectOne(config.endpoint);
    tick(15_001);

    expect(emitted).toEqual({ ok: false, reason: 'timeout' });
    // `timeout()` cancela (unsubscribe) la petición subyacente — HttpTestingController
    // la marca cancelada, por lo que `verify()` no exige que se haya flush-eado.
  }));
});
