import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { IssuanceStateService } from './core/services/issuance-state.service';
import { IdentificationReturnService } from './features/identification/identification-return.service';
import { IssuanceStartService } from './features/issuance-start/issuance-start.service';
import { CannotContinueReason } from './features/issuance-start/cannot-continue-reason';

describe('AppComponent', () => {
  const originalLocation = window.location;

  function setUrl(pathname: string, search: string): void {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, pathname, search },
    });
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
  });

  describe('baseline rendering', () => {
    beforeEach(async () => {
      setUrl('/issuance-portal/', '');
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter([])],
      }).compileComponents();
    });

    it('should create the app', () => {
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance;
      expect(app).toBeTruthy();
    });

    it('should render a router outlet', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('router-outlet')).toBeTruthy();
    });
  });

  describe('?identified=1 (EUD-164 certificate return gate)', () => {
    let identificationReturn: { handleReturn: jest.Mock; outcome: jest.Mock; reason: jest.Mock };
    let issuanceStart: { reportCannotContinue: jest.Mock };
    let state: IssuanceStateService;
    let router: Router;

    function configure(outcome: 'correlated' | 'rejected', reason: CannotContinueReason | null = null): void {
      identificationReturn = {
        handleReturn: jest.fn(),
        outcome: jest.fn().mockReturnValue(outcome),
        reason: jest.fn().mockReturnValue(reason),
      };
      issuanceStart = { reportCannotContinue: jest.fn() };

      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          provideRouter([]),
          { provide: IdentificationReturnService, useValue: identificationReturn },
          { provide: IssuanceStartService, useValue: issuanceStart },
        ],
      });

      state = TestBed.inject(IssuanceStateService);
      router = TestBed.inject(Router);
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
    }

    afterEach(() => {
      state.clearUser();
    });

    it('AC-03: a correlated return sets the user and navigates to user-data', () => {
      const encodedUser = btoa(encodeURIComponent(JSON.stringify({
        id: 'DR-1', name: 'Dra. García', collegiateNumber: '123', dni: '12345678A', email: 'a@b.com',
        phone: '+34600000000', college: 'Colegio', specialty: 'Esp', authMethod: 'claveMobile',
      })));
      setUrl('/issuance-portal/', '?' + new URLSearchParams({ identified: '1', u: encodedUser }).toString());
      configure('correlated');

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      expect(identificationReturn.handleReturn).toHaveBeenCalledTimes(1);
      expect(state.authenticatedUser()).not.toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/user-data']);
    });

    it('AC-04: a rejected return does not set a user, reports the reason, and stays on "/"', () => {
      setUrl('/issuance-portal/', '?identified=1');
      configure('rejected', CannotContinueReason.NotCorrelated);

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      expect(state.authenticatedUser()).toBeNull();
      expect(issuanceStart.reportCannotContinue).toHaveBeenCalledWith(CannotContinueReason.NotCorrelated);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('the legacy demo branch (?code= at portal root) still navigates without going through the gate (R-3)', () => {
      setUrl('/issuance-portal/', '?code=abc123');
      configure('rejected');

      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      expect(identificationReturn.handleReturn).not.toHaveBeenCalled();
      expect(state.authenticatedUser()).not.toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
