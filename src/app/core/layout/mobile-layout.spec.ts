import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { MOBILE_LAYOUT_QUERY, MobileLayout, OPEN_WALLET } from './mobile-layout';

describe('MobileLayout', () => {
  let listeners: ((event: MediaQueryListEvent) => void)[];
  let matchMedia: jest.Mock;

  function withMatchMedia(matches: boolean): void {
    listeners = [];
    matchMedia = jest.fn(() => ({
      matches,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
      removeEventListener: jest.fn(),
    }));
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: { matchMedia } } }],
    });
  }

  it('AC-13, EC-08: asks for a narrow screen with a coarse pointer, not the user agent', () => {
    withMatchMedia(true);

    expect(TestBed.inject(MobileLayout).mobile()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(MOBILE_LAYOUT_QUERY);
    expect(MOBILE_LAYOUT_QUERY).toBe('(max-width: 767.98px) and (pointer: coarse)');
  });

  it('EC-08: anything else is a computer', () => {
    withMatchMedia(false);

    expect(TestBed.inject(MobileLayout).mobile()).toBe(false);
  });

  it('follows the changes of the screen', () => {
    withMatchMedia(false);
    const layout = TestBed.inject(MobileLayout);

    listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));

    expect(layout.mobile()).toBe(true);
  });

  it('without matchMedia, is a computer', () => {
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView: {} } }] });

    expect(TestBed.inject(MobileLayout).mobile()).toBe(false);
  });
});

describe('OPEN_WALLET', () => {
  it('AC-13, AC-14: opens the wallet in the same tab', () => {
    const assign = jest.fn();
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView: { location: { assign } } } }] });

    TestBed.inject(OPEN_WALLET)('https://wallet.example/t/abc');

    expect(assign).toHaveBeenCalledWith('https://wallet.example/t/abc');
  });
});
