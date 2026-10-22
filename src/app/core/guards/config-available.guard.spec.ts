import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { configAvailableGuard, configUnavailableGuard } from './config-available.guard';
import { PortalConfigService, PortalConfigState } from '../config/portal-config.service';
import { PortalConfig } from '../api/generated/journey';

describe('configuration guards', () => {
  const state = signal<PortalConfigState>({ status: 'loading' });
  const config = { languages: ['es'] } as PortalConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PortalConfigService, useValue: { state } }],
    });
  });

  function run(guard: typeof configAvailableGuard): boolean | string {
    const result = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
  }

  it('ES-01: sends every screen to the unavailable screen when the configuration is unavailable', () => {
    state.set({ status: 'unavailable' });

    expect(run(configAvailableGuard)).toBe('/unavailable');
  });

  it('lets the screens through once the configuration is loaded', () => {
    state.set({ status: 'loaded', config });

    expect(run(configAvailableGuard)).toBe(true);
  });

  it('shows the unavailable screen only when the configuration is unavailable', () => {
    state.set({ status: 'unavailable' });
    expect(run(configUnavailableGuard)).toBe(true);

    state.set({ status: 'loaded', config });
    expect(run(configUnavailableGuard)).toBe('/');
  });
});
