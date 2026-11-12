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
  const config: PortalConfig = { texts: {}, support: {}, legal_links: {}, wallet_url: 'https://cgcom.example/wallet' };
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

  it.each(['/', '/identify', '/entitlement', '/user-data', '/verify-email', '/offer', '/incidents', '/incidents/sent', '/error/config-unavailable', '/error/session-expired', '/cliente'])(
    'AC-05: visiting %s leaves no holder data in the storage or the address',
    async (url) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);

      expect(storageContents()).not.toMatch(holderData);
      expect(TestBed.inject(Router).url).not.toMatch(/[?&](u|code|identified)=/);
    },
  );

  it.each(['/?u=eyJuYW1lIjoiRHJhIn0&code=abc&identified=1', '/user-data?u=eyJuYW1lIjoiRHJhIn0', '/unavailable?identified=1'])(
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

  describe('NFR-1 (EUD-286, EUD-358): Comprobación, Datos, Verificar correo and QR', () => {
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
      email_required: true,
    };
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
      TestBed.overrideProvider(EntitlementApi, {
        useValue: {
          verifyEntitlement: () => {
            journey = { state: 'in_progress', step: 'entitlement_confirmed', attestation };
            return of({ result: 'confirmed', attestation });
          },
        },
      });
      TestBed.overrideProvider(JourneyApi, {
        useValue: {
          getJourney: () => of(journey),
          sendEmailCode: () => {
            const verification = { email, verified: false, resend_available_at: IN_THREE_MINUTES(), sends_left: 2 };
            journey = { state: 'in_progress', step: 'entitlement_confirmed', attestation, email_verification: verification };
            return of(verification);
          },
          checkEmailCode: () => {
            const verification = { email, verified: true, resend_available_at: IN_THREE_MINUTES(), sends_left: 2 };
            journey = { state: 'in_progress', step: 'email_verified', attestation, email_verification: verification };
            return of(journey);
          },
          confirmAndIssue: () => {
            journey = { state: 'completed', step: 'offer_obtained', attestation, offer };
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
      expect(TestBed.inject(Router).url).toBe('/user-data');

      harness.detectChanges();
      const input = (harness.routeNativeElement as HTMLElement).querySelector('#holder-email') as HTMLInputElement;
      input.value = email;
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();
      (harness.routeNativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/verify-email');
      const first = (harness.routeNativeElement as HTMLElement).querySelector('input')!;
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: () => code } });
      first.dispatchEvent(paste);
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/offer');
      // QR lee el recorrido y pide la oferta al entrar: se dejan terminar esas llamadas.
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      expect(TestBed.inject(CredentialOfferService).address()?.url).toBe(onboardingUrl);
      const browser = [storageContents(), TestBed.inject(Router).url, JSON.stringify(history.state ?? {})].join('\n');
      for (const value of [email, code, onboardingUrl, 'María Holder Privada', '282809999']) {
        expect(browser).not.toContain(value);
      }
    });
  });

  it('keeps any other query parameter', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/?lang=en&code=abc');

    expect(TestBed.inject(Router).url).toBe('/?lang=en');
  });
});
