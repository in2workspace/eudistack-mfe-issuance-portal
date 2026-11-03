import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { ApiProblemError, NETWORK_ERROR } from '../../../core/api/api-problem.error';
import { IncidentsApi, PortalConfig, PortalConfigSupport } from '../../../core/api/generated/journey';
import { PortalConfigService } from '../../../core/config/portal-config.service';
import { IncidentsComponent } from './incidents.component';

expect.extend(toHaveNoViolations);

const SUPPORT: PortalConfigSupport = { email: 'soporte@tenant.example', phone: '911 000 000', schedule: 'L-V 8:00-15:00', response_time: '48 horas' };

const VALID = {
  name: 'Ana Pérez',
  email: 'ana@example.org',
  type: 'access',
  subject: 'No puedo entrar',
  description: 'El Verifier no me deja continuar.',
};

describe('IncidentsComponent', () => {
  let fixture: ComponentFixture<IncidentsComponent>;
  let page: HTMLElement;
  let sendIncident: jest.Mock<Observable<{ response_time: string }>>;
  const config = signal<PortalConfig | null>(null);

  function render(support: PortalConfigSupport = SUPPORT): void {
    config.set({ wallet_url: 'https://wallet.example', texts: {}, legal_links: {}, support });
    fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  }

  function field(id: string): HTMLInputElement {
    return page.querySelector(`#${id}`) as HTMLInputElement;
  }

  function fill(values: Partial<Record<keyof typeof VALID | 'phone', string>>): void {
    for (const [id, value] of Object.entries(values)) {
      const el = field(id);
      el.value = value;
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
      el.dispatchEvent(new Event('blur'));
    }
    fixture.detectChanges();
  }

  function submitButton(): HTMLButtonElement {
    return page.querySelector('[data-testid="incident-submit"]') as HTMLButtonElement;
  }

  async function submit(): Promise<void> {
    page.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    sendIncident = jest.fn().mockReturnValue(of({ response_time: '24 horas' }));
    TestBed.configureTestingModule({
      imports: [IncidentsComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: IncidentsApi, useValue: { sendIncident } },
        { provide: PortalConfigService, useValue: { config } },
      ],
    });
  });

  describe('AC-05: required fields', () => {
    it('"Enviar incidencia" is disabled with the empty form', () => {
      render();

      expect(submitButton().disabled).toBe(true);
    });

    it('is enabled with every required field valid and no phone', () => {
      render();
      fill(VALID);

      expect(submitButton().disabled).toBe(false);
    });

    it.each(Object.keys(VALID))('stays disabled and sends nothing without %s', async (missing) => {
      render();
      fill({ ...VALID, [missing]: '' });

      expect(submitButton().disabled).toBe(true);
      await submit();
      expect(sendIncident).not.toHaveBeenCalled();
    });

    it('stays disabled with an email without a valid format, and says so', () => {
      render();
      fill({ ...VALID, email: 'ana.example.org' });

      expect(submitButton().disabled).toBe(true);
      expect(field('email').getAttribute('aria-invalid')).toBe('true');
      expect(page.querySelector('#email-error')?.textContent?.trim()).toBe('incidents.field.email.invalid');
    });
  });

  describe('AC-04: sending', () => {
    it('sends the fields with the type as a code, without the empty phone, and goes to Ayuda enviada with the response time', async () => {
      render();
      const navigateByUrl = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fill(VALID);

      await submit();

      expect(sendIncident).toHaveBeenCalledWith({
        name: 'Ana Pérez',
        email: 'ana@example.org',
        type: 'access',
        subject: 'No puedo entrar',
        description: 'El Verifier no me deja continuar.',
      });
      expect(navigateByUrl).toHaveBeenCalledWith('/incidents/sent', { state: { responseTime: '24 horas' } });
    });

    it('sends the phone when the holder writes it', async () => {
      render();
      jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fill({ ...VALID, phone: '600 000 000' });

      await submit();

      expect(sendIncident).toHaveBeenCalledWith(expect.objectContaining({ phone: '600 000 000' }));
    });
  });

  describe('AC-06, ES-01, ES-02: a failed sending', () => {
    it.each([
      ['400 bad_request', new ApiProblemError('bad_request', 400, 'Bad request')],
      ['429 too_many_requests', new ApiProblemError('too_many_requests', 429, 'Too many requests')],
      ['503', new ApiProblemError('service_unavailable', 503, 'Service unavailable')],
      ['a network error', new ApiProblemError(NETWORK_ERROR, 0, 'Network error')],
    ])('after %s shows the notice, keeps what was written and allows sending again', async (_, error) => {
      render();
      const navigateByUrl = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');
      sendIncident.mockReturnValueOnce(throwError(() => error));
      fill({ ...VALID, phone: '600 000 000' });

      await submit();

      const notice = page.querySelector('[data-testid="incident-failed"]');
      expect(notice?.getAttribute('role')).toBe('alert');
      expect(notice?.textContent?.trim()).toBe('incidents.failed');
      expect(notice?.textContent).not.toMatch(/\d{3}|too_many|bad_request|network/i);
      expect(navigateByUrl).not.toHaveBeenCalled();
      for (const [id, value] of Object.entries({ ...VALID, phone: '600 000 000' })) {
        expect(field(id).value).toBe(value);
      }
      expect(submitButton().disabled).toBe(false);

      navigateByUrl.mockResolvedValue(true);
      await submit();
      expect(sendIncident).toHaveBeenCalledTimes(2);
      expect(page.querySelector('[data-testid="incident-failed"]')).toBeNull();
    });
  });

  it('EC-04: while sending, the button is disabled and only one call goes out', async () => {
    render();
    sendIncident.mockReturnValue(NEVER);
    fill(VALID);

    page.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    page.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(submitButton().disabled).toBe(true);
    expect(sendIncident).toHaveBeenCalledTimes(1);
  });

  it('EC-03: the fields cannot go over the lengths of the contract', () => {
    render();

    expect(field('name').getAttribute('maxlength')).toBe('200');
    expect(field('phone').getAttribute('maxlength')).toBe('30');
    expect(field('subject').getAttribute('maxlength')).toBe('200');
    expect(field('description').getAttribute('maxlength')).toBe('5000');

    fill({ ...VALID, description: 'x'.repeat(5001) });
    expect(submitButton().disabled).toBe(true);
  });

  describe('AC-07: support panel and response time from the configuration', () => {
    it('shows the support email, phone and schedule and the response time notice', () => {
      render();

      expect(page.querySelectorAll('[data-testid="incident-support"] li')).toHaveLength(3);
      expect(page.querySelector('[data-testid="incident-response-time"]')).not.toBeNull();
    });

    it('EC-01: a missing support detail is not shown, and without any there is no panel', () => {
      render({ email: 'soporte@tenant.example' });
      expect(page.querySelectorAll('[data-testid="incident-support"] li')).toHaveLength(1);

      render({});
      expect(page.querySelector('[data-testid="incident-support"]')).toBeNull();
    });

    it('EC-02: without a response time in the configuration there is no notice', () => {
      render({ email: 'soporte@tenant.example' });

      expect(page.querySelector('[data-testid="incident-response-time"]')).toBeNull();
    });

    it('"Cancelar" goes to Inicio', () => {
      render();
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      page.querySelector<HTMLButtonElement>('button[type="button"]')?.click();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  it('AC-08: the four types are translated and there is no invented incident number nor link to "#"', () => {
    render();

    const options = Array.from(page.querySelectorAll('#type option')).map((o) => o.textContent?.trim());
    expect(options).toEqual([
      'incidents.field.type.placeholder',
      'incidents.type.technical',
      'incidents.type.access',
      'incidents.type.credentials',
      'incidents.type.other',
    ]);
    expect(page.textContent).not.toMatch(/INC-/);
    expect(page.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it('NFR-1: has no automatically detectable a11y violations, also with the failure notice (jest-axe)', async () => {
    render();
    sendIncident.mockReturnValueOnce(throwError(() => new ApiProblemError('too_many_requests', 429, 'Too many requests')));
    fill(VALID);
    await submit();

    expect(await axe(page)).toHaveNoViolations();
  });
});
