import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { IncidentSentComponent } from './incident-sent.component';
import {
  INCIDENT_SENT_PATH,
  IncidentSentStore,
  incidentResponseTimeResolver,
  incidentSentGuard,
} from './incident-sent.route';

expect.extend(toHaveNoViolations);

@Component({ template: 'inicio' })
class HomeStubComponent {}

describe('IncidentSentComponent', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideRouter([
          { path: '', component: HomeStubComponent },
          {
            path: INCIDENT_SENT_PATH,
            component: IncidentSentComponent,
            canActivate: [incidentSentGuard],
            resolve: { responseTime: incidentResponseTimeResolver },
          },
        ]),
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { 'incidents.sent.responseTime': 'Te responderemos en {{responseTime}} por correo.' });
    translate.use('es');
    harness = await RouterTestingHarness.create();
  });

  /** Lo que hace Ayuda al recibir el 202: guarda el plazo en memoria y navega. */
  async function sendWith(responseTime: string): Promise<HTMLElement> {
    TestBed.inject(IncidentSentStore).set(responseTime);
    await TestBed.inject(Router).navigateByUrl(`/${INCIDENT_SENT_PATH}`);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('AC-04: shows that the incident was received with the response time returned by the service', async () => {
    const page = await sendWith('48 horas');

    expect(page.querySelector('h1')?.textContent?.trim()).toBe('incidents.sent.title');
    expect(TestBed.inject(Router).url).toBe('/incidents/sent');
    expect(page.querySelector('[data-testid="incident-sent-response-time"]')?.textContent?.trim()).toBe(
      'Te responderemos en 48 horas por correo.',
    );
  });

  it('AC-04: "Volver al inicio" goes to Inicio', async () => {
    const page = await sendWith('48 horas');

    page.querySelector('button')?.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('EC-05: a direct link to Ayuda enviada goes to Inicio', async () => {
    await harness.navigateByUrl(`/${INCIDENT_SENT_PATH}`);

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('EC-05: a reload goes to Inicio, even with the response time in the history state', async () => {
    // Al recargar, el router restaura history.state como estado de la navegación inicial.
    await TestBed.inject(Router).navigateByUrl(`/${INCIDENT_SENT_PATH}`, { state: { responseTime: '48 horas' } });

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('EC-05: coming back to Ayuda enviada after leaving it goes to Inicio', async () => {
    await sendWith('48 horas');
    await harness.navigateByUrl('/');

    await harness.navigateByUrl(`/${INCIDENT_SENT_PATH}`);

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('NFR-1: has no automatically detectable a11y violations (jest-axe)', async () => {
    const page = await sendWith('48 horas');

    expect(await axe(page)).toHaveNoViolations();
  });
});
