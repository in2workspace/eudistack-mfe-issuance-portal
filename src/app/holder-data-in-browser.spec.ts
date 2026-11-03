import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { routes } from './app.routes';
import { PortalConfigService, PortalConfigState } from './core/config/portal-config.service';
import { IncidentsApi, PortalConfig } from './core/api/generated/journey';
import { of } from 'rxjs';

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

  it.each(['/', '/identify', '/user-data', '/offer', '/incidents', '/incidents/sent', '/error/config-unavailable', '/error/session-expired', '/cliente'])(
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

  it('keeps any other query parameter', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/?lang=en&code=abc');

    expect(TestBed.inject(Router).url).toBe('/?lang=en');
  });
});
