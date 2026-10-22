import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { routes } from './app.routes';
import { PortalConfigService, PortalConfigState } from './core/config/portal-config.service';
import { PortalConfig } from './core/api/generated/journey';

/**
 * AC-06 / NFR-2: recorre todas las rutas y comprueba que ni el
 * almacenamiento del navegador ni la dirección tienen identidad, datos de la
 * atestación o correo del titular.
 */
describe('Holder data in the browser', () => {
  const config: PortalConfig = { branding: {}, languages: ['es'], texts: {}, support: {}, legal_links: {} };
  const holderData = /dni|nif|givenName|familyName|email|correo|colegiado|collegiate|specialty|especialidad|@/i;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PortalConfigService, useValue: { state: signal<PortalConfigState>({ status: 'loaded', config }), config: () => config } },
      ],
    });
  });

  function storageContents(): string {
    const read = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, i) => storage.key(i) as string).map((key) => `${key}=${storage.getItem(key)}`);
    return [...read(sessionStorage), ...read(localStorage)].join('\n');
  }

  it.each(['/', '/identify', '/user-data', '/offer', '/incidents', '/unavailable', '/cliente'])(
    'AC-06: visiting %s leaves no holder data in the storage or the address',
    async (url) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);

      expect(storageContents()).not.toMatch(holderData);
      expect(TestBed.inject(Router).url).not.toMatch(/[?&](u|code|identified)=/);
    },
  );

  it('EC-01: an old demo address with ?u= and ?code= stores nothing of the holder', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/?u=eyJuYW1lIjoiRHJhIn0&code=abc&identified=1');

    expect(storageContents()).not.toMatch(holderData);
  });
});
