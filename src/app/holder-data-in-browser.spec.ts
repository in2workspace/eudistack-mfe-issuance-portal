import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { routes } from './app.routes';
import { PortalConfigService, PortalConfigState } from './core/config/portal-config.service';
import { IncidentsApi, Journey, JourneyApi, PortalConfig } from './core/api/generated/journey';
import { EntitlementApi } from './core/api/generated/authentic-source';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from './core/api/issuance-portal-api.interceptor';
import { CredentialOfferService } from './features/credential-offer/credential-offer.service';
import { of } from 'rxjs';
import { HolderAuthService } from './core/auth/holder-auth.service';
import { OidcFlowStorage } from './core/auth/oidc-flow-storage';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mocked') },
}));

/**
 * AC-05 / NFR-2: recorre todas las rutas y comprueba que ni el
 * almacenamiento del navegador ni la dirección tienen identidad, datos de la
 * atestación o correo del titular.
 */
describe('Holder data in the browser', () => {
  const config: PortalConfig = { texts: {}, support: {}, legal_links: {}, wallet_url: 'https://cgcom.example/wallet', assurance_level: 'high' };
  const holderData = /dni|nif|givenName|familyName|email|correo|colegiado|collegiate|specialty|especialidad|@/i;
  const sendIncident = jest.fn();

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sendIncident.mockReset().mockReturnValue(of({ response_time: '72 horas' }));
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PortalConfigService, useValue: { state: signal<PortalConfigState>({ status: 'loaded', config }), config: () => config } },
        { provide: IncidentsApi, useValue: { sendIncident } },
      ],
    });
  });

  function storageContents(): string {
    const read = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, i) => storage.key(i) as string).map((key) => `${key}=${storage.getItem(key)}`);
    return [...read(sessionStorage), ...read(localStorage)].join('\n');
  }

  it.each(['/', '/identify', '/entitlement', '/email', '/requests', '/done', '/no-requests', '/request-unavailable', '/requests/r1/data', '/requests/r1/offer', '/incidents', '/incidents/sent', '/error/config-unavailable', '/error/session-expired', '/cliente'])(
    'AC-05: visiting %s leaves no holder data in the storage or the address',
    async (url) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);

      expect(storageContents()).not.toMatch(holderData);
      expect(TestBed.inject(Router).url).not.toMatch(/[?&](u|code|identified)=/);
    },
  );

  it.each(['/?u=eyJuYW1lIjoiRHJhIn0&code=abc&identified=1', '/requests/r1/data?u=eyJuYW1lIjoiRHJhIn0', '/unavailable?identified=1'])(
    'AC-05, EC-01: an old demo address (%s) stores nothing and its parameters leave the address',
    async (url) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);

      expect(storageContents()).not.toMatch(holderData);
      expect(TestBed.inject(Router).url).not.toMatch(/[?&](u|code|identified)=/);
    },
  );

  it('NFR-2 (EUD-284): sending an incident leaves neither what was written nor the response time in the browser', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/incidents');
    const page = harness.routeNativeElement as HTMLElement;
    const written = {
      name: 'Ana Pérez Holder',
      email: 'ana.holder@example.org',
      phone: '600111222',
      type: 'access',
      subject: 'Asunto privado del titular',
      description: 'Descripción privada del titular',
    };
    for (const [id, value] of Object.entries(written)) {
      const field = page.querySelector(`#${id}`) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
    }
    harness.detectChanges();

    page.querySelector<HTMLButtonElement>('[data-testid="incident-submit"]')?.click();
    await harness.fixture.whenStable();

    expect(sendIncident).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).url).toBe('/incidents/sent');
    const browser = [storageContents(), TestBed.inject(Router).url, JSON.stringify(history.state ?? {})].join('\n');
    for (const value of [...Object.values(written), '72 horas']) {
      expect(browser).not.toContain(value);
    }
  });

  describe('NFR-1 (EUD-286, EUD-358, EUD-359): Comprobación, Correo, Datos and QR', () => {
    const email = 'maria.holder@example.org';
    const code = '482913';
    const IN_THREE_MINUTES = () => new Date(Date.now() + 180_000).toISOString();
    const onboardingUrl = 'https://cgcom.example/t/Zk3q9Xw2Lp7Rt4Vb8Nc1Ha';
    const attestation = {
      type_name: 'DoctorID',
      fields: [
        { label: 'Nombre', value: 'María Holder Privada' },
        { label: 'Número de colegiado', value: '282809999' },
      ],
    };
    const request = { id: 'r1', status: 'available' as const, attestation, organization: 'Colegio Privado', display_identifier: '282809999' };
    let journey: Journey;

    beforeEach(() => {
      journey = { state: 'in_progress', step: 'identified' };
      const offer = {
        credential_offer_uri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffer%2F1',
        expires_at: new Date(Date.now() + 600_000).toISOString(),
        onboarding_url: onboardingUrl,
        onboarding_expires_at: new Date(Date.now() + 300_000).toISOString(),
      };
      TestBed.overrideProvider(ISSUANCE_PORTAL_ACCESS_TOKEN, { useValue: () => 'test-access-token' });
      TestBed.overrideProvider(HolderAuthService, { useValue: { givenName: () => 'María' } });
      TestBed.overrideProvider(EntitlementApi, {
        useValue: {
          verifyEntitlement: () => {
            journey = { state: 'in_progress', step: 'entitlement_confirmed', known_email: email, requests: [request] };
            return of({ result: 'confirmed', requests: [{ ...request, renewal: false }] });
          },
        },
      });
      TestBed.overrideProvider(JourneyApi, {
        useValue: {
          getJourney: () => of(journey),
          sendEmailCode: () => {
            const verification = {
              email,
              verified: false,
              code_expires_at: new Date(Date.now() + 600_000).toISOString(),
              resend_available_at: IN_THREE_MINUTES(),
              sends_left: 2,
            };
            journey = { ...journey, email_verification: verification };
            return of(verification);
          },
          checkEmailCode: () => {
            const verification = { email, verified: true, resend_available_at: IN_THREE_MINUTES(), sends_left: 2 };
            journey = { ...journey, step: 'email_verified', email_verification: verification };
            return of(journey);
          },
          confirmAndIssue: () => {
            journey = {
              ...journey,
              state: 'completed',
              step: 'offer_obtained',
              requests: [{ ...request, status: 'in_offer', offer }],
            };
            return of(offer);
          },
        },
      });
    });

    afterEach(() => TestBed.inject(CredentialOfferService).reset());

    it('the email, the attestation data and the onboarding address stay out of the browser', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/entitlement');
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/email');

      harness.detectChanges();
      (harness.routeNativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      const first = (harness.routeNativeElement as HTMLElement).querySelector('input')!;
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: () => code } });
      first.dispatchEvent(paste);
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/requests/r1/data');
      harness.detectChanges();
      Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'userData.continue')!
        .click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/requests/r1/offer');
      // QR lee el recorrido y pide la oferta al entrar: se dejan terminar esas llamadas.
      for (let i = 0; i < 50 && !TestBed.inject(CredentialOfferService).address(); i++) {
        harness.detectChanges();
        await harness.fixture.whenStable();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(TestBed.inject(CredentialOfferService).address()?.url).toBe(onboardingUrl);
      const browser = [storageContents(), TestBed.inject(Router).url, JSON.stringify(history.state ?? {})].join('\n');
      for (const value of [email, code, onboardingUrl, 'María Holder Privada', '282809999', 'Colegio Privado']) {
        expect(browser).not.toContain(value);
      }
    });
  });

  describe('NFR-3 (EUD-314): the login with the Verifier', () => {
    const accessToken = 'at.secret-access-token';
    const idToken = 'idt.secret-id-token';
    const refreshToken = 'secret-refresh-token';
    const givenName = 'Maria Holder Privada';
    let storage: OidcFlowStorage;

    /** Lo que la librería OIDC guarda al canjear el código, escrito como ella: un único valor JSON por configuración. */
    function libraryStoresTheTokens(): void {
      storage.write(
        'issuance-portal',
        JSON.stringify({
          authnResult: { access_token: accessToken, id_token: idToken, refresh_token: refreshToken },
          userData: { given_name: givenName, family_name: 'Apellido Privado', personal_administrative_number: 'IDESX-00000000T' },
        }),
      );
    }

    beforeEach(() => {
      TestBed.overrideProvider(JourneyApi, { useValue: { openJourney: () => of({ state: 'in_progress', step: 'identified' }), getJourney: () => of({ state: 'in_progress', step: 'identified' }) } });
      TestBed.overrideProvider(ISSUANCE_PORTAL_ACCESS_TOKEN, { useValue: () => accessToken });
      TestBed.overrideProvider(HolderAuthService, {
        useValue: {
          completeLogin: async () => {
            libraryStoresTheTokens();
            storage.clearFlow();
            return 'authenticated';
          },
          accessToken: () => accessToken,
          takeReturnPath: () => storage.takeReturnPath(),
          discard: () => storage.clear(),
        },
      });
      storage = TestBed.inject(OidcFlowStorage);
    });

    it('AC-08: coming back from the Verifier leaves no token, name or code in the storage or the address', async () => {
      // Lo que deja la ida al Verifier: el verificador PKCE, el state y el nonce.
      storage.write('issuance-portal', JSON.stringify({ codeVerifier: 'cv', authStateControl: 'st', authNonce: 'no' }));
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/callback?code=abc&state=st');
      for (let attempt = 0; attempt < 20 && TestBed.inject(Router).url.startsWith('/callback'); attempt++) {
        await new Promise((resolve) => setTimeout(resolve));
      }
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/entitlement');
      const browser = [storageContents(), TestBed.inject(Router).url, JSON.stringify(history.state ?? {})].join('\n');
      for (const value of [accessToken, idToken, refreshToken, givenName, 'Apellido Privado', 'IDESX-00000000T', 'code=', 'cv', 'secret']) {
        expect(browser).not.toContain(value);
      }
      expect(sessionStorage.length).toBe(0);
      expect(localStorage.length).toBe(0);
    });

    it('the tokens the library keeps are only in memory', () => {
      libraryStoresTheTokens();

      expect(storageContents()).toBe('');
      expect(storage.read('issuance-portal')).toContain(accessToken);
    });
  });

  it('keeps any other query parameter', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/?lang=en&code=abc');

    expect(TestBed.inject(Router).url).toBe('/?lang=en');
  });
});
