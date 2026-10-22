import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppComponent } from './app.component';
import { PortalConfigService, PortalConfigState } from './core/config/portal-config.service';

describe('AppComponent', () => {
  const originalLocation = window.location;

  function setUrl(pathname: string, search: string): void {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, pathname, search },
    });
  }

  const configState = signal<PortalConfigState>({ status: 'loading' });

  beforeEach(async () => {
    sessionStorage.clear();
    configState.set({ status: 'loading' });
    await TestBed.configureTestingModule({
      imports: [AppComponent, TranslateModule.forRoot()],
      providers: [provideRouter([]), { provide: PortalConfigService, useValue: { state: configState } }],
    }).compileComponents();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
    sessionStorage.clear();
  });

  it('should create the app', () => {
    setUrl('/issuance-portal/', '');
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a router outlet', () => {
    setUrl('/issuance-portal/', '');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeTruthy();
  });

  it('AC-04: renders the common header above every screen', () => {
    setUrl('/issuance-portal/', '');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('header').length).toBe(1);
    expect(element.querySelector('header img')).not.toBeNull();
  });

  it('ES-01: the header is neutral when the configuration is unavailable', () => {
    setUrl('/issuance-portal/', '');
    configState.set({ status: 'unavailable' });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('header img')).toBeNull();
    expect(element.querySelector('header select')).toBeNull();
  });

  it.each([
    ['?u=', `?u=${btoa(encodeURIComponent(JSON.stringify({ name: 'Dra. García', dni: '12345678A' })))}`],
    ['?code=', '?code=abc123'],
    ['?identified=1', '?identified=1'],
  ])('EC-01: a %s address from the old demo is neither read nor stored', (_, search) => {
    setUrl('/issuance-portal/', search);
    sessionStorage.setItem('cgcom_identified_user', JSON.stringify({ name: 'Dra. García' }));
    const getItem = jest.spyOn(Storage.prototype, 'getItem');
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
