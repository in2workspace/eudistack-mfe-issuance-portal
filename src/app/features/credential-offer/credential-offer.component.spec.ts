import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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

/** Las regiones con rol `status`: el explícito y el implícito de `<output>` (HTML-AAM). */
const statusRegions = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('output, [role="status"]'));

describe('CredentialOfferComponent', () => {
  let fixture: ComponentFixture<CredentialOfferComponent>;
  let service: CredentialOfferService;
  let flow: { enter: jest.Mock; newCode: jest.Mock; declareSaved: jest.Mock };
  let mobile: WritableSignal<boolean>;
  let openWallet: jest.Mock;

  beforeEach(() => {
    (QRCode.toDataURL as jest.Mock).mockClear().mockResolvedValue('data:image/png;base64,mocked');
    flow = {
      enter: jest.fn().mockResolvedValue(undefined),
      newCode: jest.fn().mockResolvedValue(undefined),
      declareSaved: jest.fn().mockResolvedValue('saved'),
    };
    mobile = signal(false);
    openWallet = jest.fn();
    TestBed.configureTestingModule({
      imports: [CredentialOfferComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: MobileLayout, useValue: { mobile } },
        { provide: OPEN_WALLET, useValue: openWallet },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ requestId: 'r2' }) } } },
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
    expect(flow.enter).toHaveBeenCalledWith('r2');
  });

  it('QR (generando): shows the waiting notice', async () => {
    service.startLoading();

    const element = await render();

    const status = statusRegions(element);
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toContain('Estamos preparando tu atestación');
  });

  describe('on a computer', () => {
    it('AC-02, AC-14: the QR is the main action and carries the same address as the copy box', async () => {
      present(582);

      const element = await render();

      expect(element.querySelector('h1')?.textContent).toContain('Escanea el código con la cámara del dispositivo donde tienes o quieres tener tu cartera');
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
      const link = buttonWith(element, '¿Tu cartera está en este dispositivo? Ábrela aquí')!;

      expect(link.compareDocumentPosition(element.querySelector('[role="timer"]')!)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
      click(element, '¿Tu cartera está en este dispositivo? Ábrela aquí');

      expect(dialog(element)?.textContent).toContain('¿Abrir tu cartera en este ordenador?');
      expect(dialog(element)?.textContent).toContain('Abre tu cartera aquí solo si es tu ordenador personal.');
      expect(dialog(element)?.textContent).toContain('Si sigues, cierra la sesión de tu cartera al terminar.');
      expect(document.activeElement?.textContent?.trim()).toBe('Volver al código');
      expect(openWallet).not.toHaveBeenCalled();
    });

    it('AC-14: «Volver al código», the recommended option, is the highlighted one', async () => {
      present(582);
      const element = await render();
      click(element, '¿Tu cartera está en este dispositivo? Ábrela aquí');

      expect(buttonWith(element, 'Volver al código')!.className).toContain('bg-brand-secondary');
      expect(buttonWith(element, 'Seguir en este ordenador')!.className).not.toContain('bg-brand-secondary');
    });

    it('AC-14: «Volver al código» goes back to the QR without opening the wallet', async () => {
      present(582);
      const element = await render();
      click(element, '¿Tu cartera está en este dispositivo? Ábrela aquí');

      click(element, 'Volver al código');

      expect(dialog(element)).toBeNull();
      expect(openWallet).not.toHaveBeenCalled();
      expect(document.activeElement?.textContent?.trim()).toBe('¿Tu cartera está en este dispositivo? Ábrela aquí');
    });

    it('AC-14: Escape goes back to the QR without opening the wallet', async () => {
      present(582);
      const element = await render();
      click(element, '¿Tu cartera está en este dispositivo? Ábrela aquí');

      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(dialog(element)).toBeNull();
      expect(openWallet).not.toHaveBeenCalled();
    });

    it('AC-14: «Seguir en este ordenador» opens the wallet with the QR address', async () => {
      present(582);
      const element = await render();
      click(element, '¿Tu cartera está en este dispositivo? Ábrela aquí');

      click(element, 'Seguir en este ordenador');

      expect(openWallet).toHaveBeenCalledWith(ONBOARDING_URL);
    });

    it('AC-05: without QR, opening the wallet becomes the main button and still shows the notice', async () => {
      present(582, LONG_URL);
      const element = await render();

      expect(element.textContent).toContain('No se ha podido generar el código.');
      expect(element.querySelector('app-credential-offer-url-box')).not.toBeNull();
      expect(buttonWith(element, '¿Tu cartera está en este dispositivo? Ábrela aquí')).toBeUndefined();
      click(element, 'Abrir en mi cartera');

      expect(dialog(element)).not.toBeNull();
      expect(openWallet).not.toHaveBeenCalled();
    });

    it('AC-05: when the QR fails to generate, behaves as without QR', async () => {
      (QRCode.toDataURL as jest.Mock).mockRejectedValue(new Error('too much data'));
      present(582);

      const element = await render();

      expect(element.querySelector('img[width="280"]')).toBeNull();
      expect(element.textContent).toContain('No se ha podido generar el código.');
      expect(buttonWith(element, 'Abrir en mi cartera')).toBeDefined();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => mobile.set(true));

    it('AC-13: «Abrir en mi cartera» goes first, in the same tab, with the QR address and no notice', async () => {
      present(582);

      const element = await render();

      const open = element.querySelector('a[href]') as HTMLAnchorElement;
      expect(element.querySelector('h1')?.textContent).toContain('Añade tu atestación a tu cartera');
      expect(open.textContent?.trim()).toBe('Abrir en mi cartera');
      expect(open.getAttribute('href')).toBe(ONBOARDING_URL);
      expect(open.hasAttribute('target')).toBe(false);
      expect(open.compareDocumentPosition(element.querySelector('img[width="280"]')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(element.textContent).toContain('¿Usas otro dispositivo? Escanea este código:');
      expect(buttonWith(element, '¿Tu cartera está en este dispositivo? Ábrela aquí')).toBeUndefined();
    });
  });

  describe('expired', () => {
    it.each([false, true])('AC-06: dims the QR and offers only a new code (phone: %s)', async (onPhone) => {
      mobile.set(onPhone);
      present(-1);

      const element = await render();

      expect(element.querySelector('img[width="280"]')?.classList).toContain('opacity-30');
      expect(statusRegions(element).map((s) => s.textContent).join()).toContain('El código ha caducado.');
      expect(element.querySelector('a[href]')).toBeNull();
      expect(element.querySelector('app-credential-offer-url-box')).toBeNull();
      expect(buttonWith(element, '¿Tu cartera está en este dispositivo? Ábrela aquí')).toBeUndefined();
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
      expect(flow.newCode).toHaveBeenCalledWith('r2');
    });
  });

  describe('Ya lo he guardado (AD-10, FR-16)', () => {
    it('AC-05: on a computer it is the main action, with the countdown before it and the discreet wallet link after it', async () => {
      present(582);
      const element = await render();
      const saved = buttonWith(element, 'Ya lo he guardado')!;
      const link = buttonWith(element, '¿Tu cartera está en este dispositivo? Ábrela aquí')!;

      expect(saved.className).toContain('bg-brand-secondary');
      expect(link.className).not.toContain('bg-brand-secondary');
      expect(saved.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(element.querySelector('[role="timer"]')!.compareDocumentPosition(saved)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('AC-12: on a phone «Abrir en mi cartera» goes first and «Ya lo he guardado» is the secondary one, after the QR', async () => {
      mobile.set(true);
      present(582);
      const element = await render();
      const open = element.querySelector('a[href]') as HTMLAnchorElement;
      const saved = buttonWith(element, 'Ya lo he guardado')!;

      expect(open.compareDocumentPosition(saved)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(element.querySelector('img[width="280"]')!.compareDocumentPosition(saved)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(saved.className).not.toContain('bg-brand-secondary');
    });

    it.each([false, true])('AC-05: asks the flow to declare the request of the route saved (phone: %s)', async (onPhone) => {
      mobile.set(onPhone);
      present(582);
      const element = await render();

      click(element, 'Ya lo he guardado');

      expect(flow.declareSaved).toHaveBeenCalledTimes(1);
      expect(flow.declareSaved).toHaveBeenCalledWith('r2');
    });

    it('EC-07: a second click while it is being declared does nothing', async () => {
      flow.declareSaved.mockReturnValue(new Promise(() => undefined));
      present(582);
      const element = await render();

      click(element, 'Ya lo he guardado');
      buttonWith(element, 'Ya lo he guardado')!.click();

      expect(flow.declareSaved).toHaveBeenCalledTimes(1);
      expect(buttonWith(element, 'Ya lo he guardado')!.disabled).toBe(true);
    });

    it('ES-03: when the declaration failed, says it could not be recorded in an aria-live region, and the holder can press it again', async () => {
      flow.declareSaved.mockResolvedValueOnce('failed').mockResolvedValueOnce('saved');
      present(582);
      const element = await render();
      const region = element.querySelector('[data-testid="save-failed"]')!;
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.textContent?.trim()).toBe('');

      click(element, 'Ya lo he guardado');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element.querySelector('[data-testid="save-failed"]')).toBe(region);
      expect(region.textContent).toContain('No se ha podido anotar. Inténtalo de nuevo.');
      expect(buttonWith(element, 'Ya lo he guardado')!.disabled).toBe(false);

      click(element, 'Ya lo he guardado');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(flow.declareSaved).toHaveBeenCalledTimes(2);
      expect(region.textContent?.trim()).toBe('');
    });

    it('when the interceptor handled it (409, 410), shows no message and the button works again', async () => {
      flow.declareSaved.mockResolvedValue('handled');
      present(582);
      const element = await render();

      click(element, 'Ya lo he guardado');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element.querySelector('[data-testid="save-failed"]')!.textContent?.trim()).toBe('');
      expect(buttonWith(element, 'Ya lo he guardado')!.disabled).toBe(false);
    });

    it('NFR-5: has no accessibility violations with the failure message shown', async () => {
      flow.declareSaved.mockResolvedValue('failed');
      present(582);
      const element = await render();
      click(element, 'Ya lo he guardado');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(await axe(element)).toHaveNoViolations();
    });

    it('is still there with the code expired: the holder may have saved it just before', async () => {
      present(-1);

      const element = await render();

      expect(buttonWith(element, 'Ya lo he guardado')).toBeDefined();
    });

    it('AC-12: there is no «He terminado»', async () => {
      present(582);

      const element = await render();

      expect(element.textContent).not.toContain('He terminado');
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
    click(element, '¿Tu cartera está en este dispositivo? Ábrela aquí');

    expect(await axe(element)).toHaveNoViolations();
  });
});
