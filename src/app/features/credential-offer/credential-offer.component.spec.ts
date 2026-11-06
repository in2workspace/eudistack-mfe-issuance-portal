import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import QRCode from 'qrcode';
import { CredentialOfferComponent } from './credential-offer.component';
import { CredentialOfferService, MAX_QR_PAYLOAD_CHARS } from './credential-offer.service';
import { OfferFlowService } from './offer-flow.service';
import { MobileLayout, OPEN_WALLET } from '../../core/layout/mobile-layout';

expect.extend(toHaveNoViolations);

// `qrcode` hace codificación PNG real (zlib) con latencia de E/S real: se
// mockea para aislar la pantalla de la librería.
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mocked') },
}));

const ONBOARDING_URL = 'https://wallet.sandbox.dev.eudistack.net/t/Zk3q9Xw2Lp7Rt4Vb8Nc1Ha';
const LONG_URL = `https://wallet.example/${'x'.repeat(MAX_QR_PAYLOAD_CHARS)}`;

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

describe('CredentialOfferComponent', () => {
  let fixture: ComponentFixture<CredentialOfferComponent>;
  let service: CredentialOfferService;
  let flow: { enter: jest.Mock; newCode: jest.Mock; finish: jest.Mock };
  let mobile: WritableSignal<boolean>;
  let openWallet: jest.Mock;

  beforeEach(() => {
    (QRCode.toDataURL as jest.Mock).mockClear().mockResolvedValue('data:image/png;base64,mocked');
    flow = {
      enter: jest.fn().mockResolvedValue(undefined),
      newCode: jest.fn().mockResolvedValue(undefined),
      finish: jest.fn().mockResolvedValue(undefined),
    };
    mobile = signal(false);
    openWallet = jest.fn();
    TestBed.configureTestingModule({
      imports: [CredentialOfferComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: MobileLayout, useValue: { mobile } },
        { provide: OPEN_WALLET, useValue: openWallet },
      ],
    });
    TestBed.overrideComponent(CredentialOfferComponent, {
      set: { providers: [{ provide: OfferFlowService, useValue: flow }] },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    service = TestBed.inject(CredentialOfferService);
  });

  afterEach(() => {
    service.reset();
    fixture?.nativeElement.remove();
  });

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CredentialOfferComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function present(seconds: number, url = ONBOARDING_URL): void {
    service.present({ url, expiresAt: Date.now() + seconds * 1000 });
  }

  function buttonWith(element: HTMLElement, text: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  }

  /** Como con el teclado: el botón recibe el foco y se pulsa. */
  function click(element: HTMLElement, text: string): void {
    const button = buttonWith(element, text)!;
    button.focus();
    button.click();
    fixture.detectChanges();
  }

  const dialog = (element: HTMLElement) => element.querySelector('[role="dialog"]');

  it('asks the flow for the offer when the screen opens', async () => {
    await render();

    expect(flow.enter).toHaveBeenCalledTimes(1);
  });

  it('QR (generando): shows the waiting notice', async () => {
    service.startLoading();

    const element = await render();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Estamos preparando tu atestación');
  });

  describe('on a computer', () => {
    it('AC-02, AC-14: the QR is the main action and carries the same address as the copy box', async () => {
      present(582);

      const element = await render();

      expect(element.querySelector('h1')?.textContent).toContain('Escanea el código con tu wallet');
      expect(QRCode.toDataURL).toHaveBeenCalledWith(ONBOARDING_URL, expect.anything());
      expect(element.querySelector('img[width="280"]')).not.toBeNull();
      expect((element.querySelector('app-credential-offer-url-box input') as HTMLInputElement).value).toBe(ONBOARDING_URL);
      expect(element.querySelector('a[href]')).toBeNull();
    });

    it('AC-02: shows the time left as mm:ss', async () => {
      present(582);

      const element = await render();

      expect(element.querySelector('[role="timer"]')?.textContent).toContain('El código caduca en 09:42');
    });

    it('AC-14: opening the wallet is a text link under the countdown that opens the personal computer notice', async () => {
      present(582);
      const element = await render();
      const link = buttonWith(element, '¿Prefieres usar el wallet en este ordenador?')!;

      expect(link.compareDocumentPosition(element.querySelector('[role="timer"]')!)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
      click(element, '¿Prefieres usar el wallet en este ordenador?');

      expect(dialog(element)?.textContent).toContain('¿Usar el wallet en este ordenador?');
      expect(dialog(element)?.textContent).toContain('Usa el wallet solo en un ordenador personal.');
      expect(dialog(element)?.textContent).toContain('Si sigues, cierra la sesión del wallet al terminar.');
      expect(document.activeElement?.textContent?.trim()).toBe('Usar el móvil');
      expect(openWallet).not.toHaveBeenCalled();
    });

    it('AC-14: «Usar el móvil» goes back to the QR without opening the wallet', async () => {
      present(582);
      const element = await render();
      click(element, '¿Prefieres usar el wallet en este ordenador?');

      click(element, 'Usar el móvil');

      expect(dialog(element)).toBeNull();
      expect(openWallet).not.toHaveBeenCalled();
      expect(document.activeElement?.textContent?.trim()).toBe('¿Prefieres usar el wallet en este ordenador?');
    });

    it('AC-14: Escape goes back to the QR without opening the wallet', async () => {
      present(582);
      const element = await render();
      click(element, '¿Prefieres usar el wallet en este ordenador?');

      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(dialog(element)).toBeNull();
      expect(openWallet).not.toHaveBeenCalled();
    });

    it('AC-14: «Continuar en este ordenador» opens the wallet with the QR address', async () => {
      present(582);
      const element = await render();
      click(element, '¿Prefieres usar el wallet en este ordenador?');

      click(element, 'Continuar en este ordenador');

      expect(openWallet).toHaveBeenCalledWith(ONBOARDING_URL);
    });

    it('AC-05: without QR, opening the wallet becomes the main button and still shows the notice', async () => {
      present(582, LONG_URL);
      const element = await render();

      expect(element.textContent).toContain('No se ha podido generar el código.');
      expect(element.querySelector('app-credential-offer-url-box')).not.toBeNull();
      expect(buttonWith(element, '¿Prefieres usar el wallet en este ordenador?')).toBeUndefined();
      click(element, 'Abrir en mi wallet');

      expect(dialog(element)).not.toBeNull();
      expect(openWallet).not.toHaveBeenCalled();
    });

    it('AC-05: when the QR fails to generate, behaves as without QR', async () => {
      (QRCode.toDataURL as jest.Mock).mockRejectedValue(new Error('too much data'));
      present(582);

      const element = await render();

      expect(element.querySelector('img[width="280"]')).toBeNull();
      expect(element.textContent).toContain('No se ha podido generar el código.');
      expect(buttonWith(element, 'Abrir en mi wallet')).toBeDefined();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => mobile.set(true));

    it('AC-13: «Abrir en mi wallet» goes first, in the same tab, with the QR address and no notice', async () => {
      present(582);

      const element = await render();

      const open = element.querySelector('a[href]') as HTMLAnchorElement;
      expect(element.querySelector('h1')?.textContent).toContain('Añade tu atestación a tu wallet');
      expect(open.textContent?.trim()).toBe('Abrir en mi wallet');
      expect(open.getAttribute('href')).toBe(ONBOARDING_URL);
      expect(open.hasAttribute('target')).toBe(false);
      expect(open.compareDocumentPosition(element.querySelector('img[width="280"]')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(element.textContent).toContain('¿Usas otro dispositivo? Escanea este código:');
      expect(buttonWith(element, '¿Prefieres usar el wallet en este ordenador?')).toBeUndefined();
    });
  });

  describe('expired', () => {
    it.each([false, true])('AC-06: dims the QR and offers only a new code (phone: %s)', async (onPhone) => {
      mobile.set(onPhone);
      present(-1);

      const element = await render();

      expect(element.querySelector('img[width="280"]')?.classList).toContain('opacity-30');
      expect(element.querySelector('[role="status"]')?.textContent).toContain('El código ha caducado.');
      expect(element.querySelector('a[href]')).toBeNull();
      expect(element.querySelector('app-credential-offer-url-box')).toBeNull();
      expect(buttonWith(element, '¿Prefieres usar el wallet en este ordenador?')).toBeUndefined();
      expect(element.querySelector('[role="timer"]')).toBeNull();
    });

    it('AC-06: while the address is valid there is no «Generar un código nuevo»', async () => {
      present(582);

      const element = await render();

      expect(buttonWith(element, 'Generar un código nuevo')).toBeUndefined();
    });

    it('AC-06: «Generar un código nuevo» asks the flow for a new code', async () => {
      present(-1);
      const element = await render();

      click(element, 'Generar un código nuevo');

      expect(flow.newCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('He terminado', () => {
    it('AC-15: ends the journey through the flow', async () => {
      present(582);
      const element = await render();

      click(element, 'He terminado');

      expect(flow.finish).toHaveBeenCalledTimes(1);
    });

    it('EC-07: a second click while it is ending does nothing', async () => {
      flow.finish.mockReturnValue(new Promise(() => undefined));
      present(582);
      const element = await render();

      click(element, 'He terminado');
      buttonWith(element, 'He terminado')!.click();

      expect(flow.finish).toHaveBeenCalledTimes(1);
      expect(buttonWith(element, 'He terminado')!.disabled).toBe(true);
    });

    it('the demo actions are gone', async () => {
      present(582);

      const element = await render();

      expect(buttonWith(element, 'Cancelar')).toBeUndefined();
      expect(element.textContent).not.toContain('Marcar como completado');
    });
  });

  it('W5: leaving QR, for any reason, forgets the address with the ticket', async () => {
    present(582);
    await render();

    fixture.destroy();

    expect(service.address()).toBeNull();
  });

  it('N14: no element has an accessible name that hides its visible text', async () => {
    mobile.set(true);
    present(582);

    const element = await render();

    expect(element.querySelector('a[aria-label], button[aria-label]:not(app-credential-offer-url-box button)')).toBeNull();
  });

  it.each(['es', 'en'])('NFR-2: has every QR text in %s', (lang) => {
    const texts = catalog(lang);
    const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('credentialOffer.'));

    keys.forEach((key) => expect(texts[key]).toBeTruthy());
  });

  it.each([
    ['generating', false, () => service.startLoading()],
    ['ready on a computer', false, () => present(582)],
    ['ready on a phone', true, () => present(582)],
    ['without QR', false, () => present(582, LONG_URL)],
    ['expired', false, () => present(-1)],
  ])('NFR-3: has no accessibility violations while %s', async (_state, onPhone, setUp) => {
    mobile.set(onPhone);
    setUp();

    const element = await render();

    expect(await axe(element)).toHaveNoViolations();
  });

  it('NFR-3: has no accessibility violations with the personal computer notice open', async () => {
    present(582);
    const element = await render();
    click(element, '¿Prefieres usar el wallet en este ordenador?');

    expect(await axe(element)).toHaveNoViolations();
  });
});
