import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  const originalLocation = window.location;

  function setUrl(pathname: string, search: string): void {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, pathname, search },
    });
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
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
