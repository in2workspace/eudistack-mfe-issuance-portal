import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { IdentifyMethodsComponent } from './identify-methods.component';
import { IdentificationRedirectService } from '../../identification/identification-redirect.service';
import { IssuanceStartService } from '../../issuance-start/issuance-start.service';
import { DoctorIdOidcService } from '../../../core/services/doctorid-oidc.service';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { CannotContinueReason } from '../../issuance-start/cannot-continue-reason';

describe('IdentifyMethodsComponent', () => {
  let fixture: ComponentFixture<IdentifyMethodsComponent>;
  let component: IdentifyMethodsComponent;
  let identificationRedirect: { redirectToIdentification: jest.Mock };
  let issuanceStart: { reportCannotContinue: jest.Mock };
  let doctorIdOidcService: { iniciarFlujoOIDCPortal: jest.Mock };
  let router: Router;

  beforeEach(() => {
    identificationRedirect = { redirectToIdentification: jest.fn() };
    issuanceStart = { reportCannotContinue: jest.fn() };
    doctorIdOidcService = { iniciarFlujoOIDCPortal: jest.fn() };

    TestBed.configureTestingModule({
      imports: [IdentifyMethodsComponent],
      providers: [
        provideRouter([]),
        { provide: IdentificationRedirectService, useValue: identificationRedirect },
        { provide: IssuanceStartService, useValue: issuanceStart },
        { provide: DoctorIdOidcService, useValue: doctorIdOidcService },
        { provide: IssuanceStateService, useValue: { setUser: jest.fn() } },
        { provide: BrandingService, useValue: { logoUrl: signal(''), appName: signal('Portal') } },
      ],
    });

    fixture = TestBed.createComponent(IdentifyMethodsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('AC-01: choosing "Certificado Digital" delegates the exit to IdentificationRedirectService', () => {
    identificationRedirect.redirectToIdentification.mockReturnValue(null);

    component.selectMethod('certificate');

    expect(identificationRedirect.redirectToIdentification).toHaveBeenCalledTimes(1);
    expect(issuanceStart.reportCannotContinue).not.toHaveBeenCalled();
  });

  it('ES-07: choosing "Certificado Digital" without a start session in the context does not produce an external exit', () => {
    identificationRedirect.redirectToIdentification.mockReturnValue(CannotContinueReason.StartSessionAbsent);

    component.selectMethod('certificate');

    expect(issuanceStart.reportCannotContinue).toHaveBeenCalledWith(CannotContinueReason.StartSessionAbsent);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('AC-08: the "doctorId" branch never touches the certificate gate', () => {
    component.selectMethod('doctorId');

    expect(doctorIdOidcService.iniciarFlujoOIDCPortal).toHaveBeenCalledTimes(1);
    expect(identificationRedirect.redirectToIdentification).not.toHaveBeenCalled();
  });

  it.each(['eDNI', 'claveMobile', 'video'] as const)(
    'AC-08: the "%s" branch (in-app auth) never touches the certificate gate',
    (method) => {
      component.selectMethod(method);

      expect(identificationRedirect.redirectToIdentification).not.toHaveBeenCalled();
      expect(doctorIdOidcService.iniciarFlujoOIDCPortal).not.toHaveBeenCalled();
    },
  );
});
