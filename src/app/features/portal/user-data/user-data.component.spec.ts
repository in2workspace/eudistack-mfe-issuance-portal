import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { UserDataComponent } from './user-data.component';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { IssuanceEntryPointService } from '../../issuance-entry-point/issuance-entry-point.service';
import { IdentificationReturnService } from '../../identification/identification-return.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { AuthenticatedUser } from '../../../core/models/issuance.model';
import { IssuanceStartSession } from '../../issuance-start/issuance-start-session.model';

describe('UserDataComponent', () => {
  let fixture: ComponentFixture<UserDataComponent>;
  let entryPoint: { start: jest.Mock };
  let identificationReturn: {
    outcome: ReturnType<typeof signal<'correlated' | 'rejected' | 'out_of_scope'>>;
    session: ReturnType<typeof signal<IssuanceStartSession | null>>;
  };
  let state: IssuanceStateService;

  const user: AuthenticatedUser = {
    id: 'DR-1',
    name: 'Dra. García',
    collegiateNumber: '123',
    dni: '12345678A',
    email: 'a@b.com',
    phone: '+34 600 000 000',
    college: 'Colegio',
    specialty: 'Especialidad',
    authMethod: 'claveMobile',
  };

  const consumedSession: IssuanceStartSession = {
    id: 'abc123',
    tenant: 'cgcom',
    state: 'retomada',
    correlationToken: 'token',
    redirectedMethod: 'certificate',
    consumedAt: Date.now(),
  };

  function configure(outcome: 'correlated' | 'rejected' | 'out_of_scope', session: IssuanceStartSession | null): void {
    entryPoint = { start: jest.fn().mockResolvedValue(undefined) };
    identificationReturn = { outcome: signal(outcome), session: signal(session) };

    TestBed.configureTestingModule({
      imports: [UserDataComponent],
      providers: [
        provideRouter([]),
        { provide: IssuanceEntryPointService, useValue: entryPoint },
        { provide: IdentificationReturnService, useValue: identificationReturn },
        { provide: BrandingService, useValue: { logoUrl: signal(''), appName: signal('Portal') } },
      ],
    });

    state = TestBed.inject(IssuanceStateService);
    state.setUser(user);

    fixture = TestBed.createComponent(UserDataComponent);
  }

  afterEach(() => {
    state.clearUser();
  });

  it('AC-03: a correlated return starts the entry point with correlated=true and the real consumed session', () => {
    configure('correlated', consumedSession);

    fixture.detectChanges();

    expect(entryPoint.start).toHaveBeenCalledWith({ correlated: true, session: consumedSession });
  });

  it('AC-08: an out_of_scope return (the 4 methods this Story does not cover) starts the entry point with correlated=true — no regression', () => {
    configure('out_of_scope', null);

    fixture.detectChanges();

    expect(entryPoint.start).toHaveBeenCalledWith({ correlated: true, session: null });
  });

  it('a rejected return starts the entry point with correlated=false, never with the inherited literal true', () => {
    configure('rejected', null);

    fixture.detectChanges();

    expect(entryPoint.start).toHaveBeenCalledWith({ correlated: false, session: null });
  });

  it('never calls the entry point with a hardcoded correlated: true independent of the actual outcome', () => {
    configure('rejected', null);

    fixture.detectChanges();

    expect(entryPoint.start).not.toHaveBeenCalledWith({ correlated: true });
  });
});
