import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { IdentifyMethodsComponent } from './identify-methods.component';
import { IdentificationRedirectService } from '../../identification/identification-redirect.service';
import { IssuanceStartService } from '../../issuance-start/issuance-start.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { CannotContinueReason } from '../../issuance-start/cannot-continue-reason';

describe('IdentifyMethodsComponent', () => {
  let fixture: ComponentFixture<IdentifyMethodsComponent>;
  let component: IdentifyMethodsComponent;
  let identificationRedirect: { redirectToIdentification: jest.Mock };
  let issuanceStart: { reportCannotContinue: jest.Mock };
  let router: Router;

  beforeEach(() => {
    identificationRedirect = { redirectToIdentification: jest.fn() };
    issuanceStart = { reportCannotContinue: jest.fn() };

    TestBed.configureTestingModule({
      imports: [IdentifyMethodsComponent],
      providers: [
        provideRouter([]),
        { provide: IdentificationRedirectService, useValue: identificationRedirect },
        { provide: IssuanceStartService, useValue: issuanceStart },
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

  it('a method that is not available yet does nothing', () => {
    component.selectMethod('claveMobile');

    expect(identificationRedirect.redirectToIdentification).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('AC-09: shows no simulated method and no demo notice', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    expect(text).not.toMatch(/DNI Electrónico|Video Identificación|DoctorID|EmployeeID|Nota de demostración/);
    expect(buttons.find((b) => b.textContent?.includes('Cl@ve Móvil'))?.disabled).toBe(true);
    expect(buttons.find((b) => b.textContent?.includes('Certificado Digital'))?.disabled).toBe(false);
  });
});
