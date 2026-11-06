import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import QRCode from 'qrcode';
import { CredentialOfferComponent } from './credential-offer.component';
import { CredentialOfferService, MAX_QR_PAYLOAD_CHARS } from './credential-offer.service';
import { OfferFlowService } from './offer-flow.service';

expect.extend(toHaveNoViolations);

// `qrcode` hace codificación PNG real (zlib) con latencia de E/S real: se
// mockea para aislar la pantalla de la librería.
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mocked') },
}));

const ONBOARDING_URL = 'https://wallet.sandbox.dev.eudistack.net/t/Zk3q9Xw2Lp7Rt4Vb8Nc1Ha';

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

describe('CredentialOfferComponent', () => {
  let fixture: ComponentFixture<CredentialOfferComponent>;
  let service: CredentialOfferService;
  let flow: { enter: jest.Mock; newCode: jest.Mock };

  beforeEach(() => {
    flow = { enter: jest.fn().mockResolvedValue(undefined), newCode: jest.fn().mockResolvedValue(undefined) };
    (QRCode.toDataURL as jest.Mock).mockClear().mockResolvedValue('data:image/png;base64,mocked');
    TestBed.configureTestingModule({
      imports: [CredentialOfferComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(CredentialOfferComponent, {
      set: { providers: [{ provide: OfferFlowService, useValue: flow }] },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    service = TestBed.inject(CredentialOfferService);
  });

  afterEach(() => service.cancelPendingWork());

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CredentialOfferComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function present(seconds: number, url = ONBOARDING_URL): void {
    service.present({ url, expiresAt: Date.now() + seconds * 1000 });
  }

  it('QR (generando): shows the waiting notice', async () => {
    service.startLoading();

    const element = await render();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Estamos preparando tu atestación');
  });

  it('AC-02: the QR, the wallet button and the copy box carry the same address', async () => {
    present(582);

    const element = await render();

    expect(QRCode.toDataURL).toHaveBeenCalledWith(ONBOARDING_URL, expect.anything());
    expect(element.querySelector('img[width="280"]')).not.toBeNull();
    expect(element.querySelector('a[href]')?.getAttribute('href')).toBe(ONBOARDING_URL);
    expect((element.querySelector('app-credential-offer-url-box input') as HTMLInputElement).value).toBe(ONBOARDING_URL);
  });

  it('AC-02: shows the time left as mm:ss', async () => {
    present(582);

    const element = await render();

    expect(element.querySelector('[role="timer"]')?.textContent).toContain('El código caduca en 09:42');
  });

  it('AC-06: while the address is valid there is no «Generar un código nuevo»', async () => {
    present(582);

    const element = await render();

    expect(element.textContent).not.toContain('Generar un código nuevo');
  });

  it('AC-06: expired, dims the QR, says so and offers a new code instead of the wallet button and the link', async () => {
    present(-1);

    const element = await render();

    expect(element.querySelector('img[width="280"]')?.classList).toContain('opacity-30');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('El código ha caducado.');
    expect(element.textContent).toContain('Generar un código nuevo');
    expect(element.querySelector('a[href]')).toBeNull();
    expect(element.querySelector('app-credential-offer-url-box')).toBeNull();
    expect(element.querySelector('[role="timer"]')).toBeNull();
  });

  it('AC-05: an address too long for the QR shows the notice, the wallet button and the link', async () => {
    present(582, `https://wallet.example/${'x'.repeat(MAX_QR_PAYLOAD_CHARS)}`);

    const element = await render();

    expect(element.querySelector('img[width="280"]')).toBeNull();
    expect(element.textContent).toContain('No se ha podido generar el código.');
    expect(element.querySelector('a[href]')).not.toBeNull();
    expect(element.querySelector('app-credential-offer-url-box')).not.toBeNull();
  });

  it('AC-05: when the QR fails to generate, shows the same notice with the button and the link', async () => {
    (QRCode.toDataURL as jest.Mock).mockRejectedValue(new Error('too much data'));
    present(582);

    const element = await render();

    expect(element.querySelector('img[width="280"]')).toBeNull();
    expect(element.textContent).toContain('No se ha podido generar el código.');
    expect(element.querySelector('a[href]')).not.toBeNull();
  });

  it('asks the flow for the offer when the screen opens', async () => {
    await render();

    expect(flow.enter).toHaveBeenCalledTimes(1);
  });

  it('AC-06: «Generar un código nuevo» asks the flow for a new code', async () => {
    present(-1);
    const element = await render();

    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Generar un código nuevo')!
      .click();

    expect(flow.newCode).toHaveBeenCalledTimes(1);
  });

  it('stops the countdown when the screen is left', async () => {
    const cancel = jest.spyOn(service, 'cancelPendingWork');
    present(582);
    await render();

    fixture.destroy();

    expect(cancel).toHaveBeenCalled();
  });

  it.each(['es', 'en'])('NFR-2: has every QR text in %s', (lang) => {
    const texts = catalog(lang);
    const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('credentialOffer.'));

    keys.forEach((key) => expect(texts[key]).toBeTruthy());
  });

  it.each([
    ['generating', () => service.startLoading()],
    ['ready', () => present(582)],
    ['without QR', () => present(582, `https://wallet.example/${'x'.repeat(MAX_QR_PAYLOAD_CHARS)}`)],
    ['expired', () => present(-1)],
  ])('NFR-3: has no accessibility violations while %s', async (_state, setUp) => {
    setUp();

    const element = await render();

    expect(await axe(element)).toHaveNoViolations();
  });
});
