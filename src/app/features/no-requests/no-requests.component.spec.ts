import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NoRequestsComponent } from './no-requests.component';
import { PortalConfig } from '../../core/api/generated/journey';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';
import { routes } from '../../app.routes';

expect.extend(toHaveNoViolations);

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

describe('NoRequestsComponent', () => {
  let fixture: ComponentFixture<NoRequestsComponent>;
  let support: PortalConfig['support'];
  let navigate: jest.SpyInstance;
  let outcome: EntitlementOutcomeStore;

  beforeEach(() => {
    support = { email: 'soporte@example.org', phone: '900 000 000', schedule: 'L-V 9-18' };
    TestBed.configureTestingModule({
      imports: [NoRequestsComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: PortalConfigService, useValue: { config: () => ({ support }) as PortalConfig } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    outcome = TestBed.inject(EntitlementOutcomeStore);
    outcome.hold({ kind: 'no-requests' });
    fixture = TestBed.createComponent(NoRequestsComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('AC-03: says the holder has no request yet and whom to ask for it, with the support of the tenant', () => {
    expect(element().querySelector('h1')?.textContent).toBe('Todavía no tienes ninguna solicitud');
    expect(element().textContent).toContain('Pídela a tu organización o escribe al soporte:');
    expect(element().textContent).toContain('soporte@example.org');
    expect(element().textContent).toContain('900 000 000');
    expect(element().textContent).toContain('L-V 9-18');
  });

  it('shows the screen with no contact list when the tenant gives no support details', () => {
    support = {};
    fixture = TestBed.createComponent(NoRequestsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ul')).toBeNull();
  });

  it('FR-18, AC-03: «Volver al inicio» forgets what was in memory and goes to Inicio', () => {
    Array.from(element().querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Volver al inicio')!
      .click();

    expect(outcome.outcome()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('AD-8: the route has no step guard: it shows what is in memory and otherwise goes to Inicio', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];
    const route = screens.find((r) => r.path === 'no-requests');

    expect(route?.canActivate).toHaveLength(1);
    expect(route?.canActivate?.[0]).not.toBeUndefined();
  });

  it.each(['es', 'en'])('has every Sin solicitudes text in %s', (lang) => {
    const texts = catalog(lang);

    for (const key of ['title', 'description', 'contact', 'home']) {
      expect(texts[`noRequests.${key}`]).toBeTruthy();
    }
  });

  it('NFR-5: has no accessibility violations', async () => {
    expect(await axe(element())).toHaveNoViolations();
  });
});
