import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IssuanceInfoComponent } from './issuance-info.component';

/** Selects the single "arranque" CTA among the page's buttons. */
function queryStartCta(compiled: HTMLElement): HTMLButtonElement | null {
  return compiled.querySelector('button[aria-label="issuanceInfo.cta.ariaLabel"]');
}

describe('IssuanceInfoComponent', () => {
  let fixture: ComponentFixture<IssuanceInfoComponent>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [IssuanceInfoComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(IssuanceInfoComponent);
    fixture.detectChanges();
  });

  it('renders info + a single visible start CTA with clear action text (AC-01, AC-04)', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const startCtas = compiled.querySelectorAll('button[aria-label="issuanceInfo.cta.ariaLabel"]');

    expect(compiled.querySelectorAll('h1').length).toBe(1);
    expect(startCtas.length).toBe(1);
    expect(startCtas[0].textContent?.trim().length).toBeGreaterThan(0);
  });

  it('AC-06: "Empezar" leads to no own identification and stores nothing in the browser', () => {
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate');
    const navigateByUrl = jest.spyOn(router, 'navigateByUrl');

    queryStartCta(fixture.nativeElement as HTMLElement)?.click();

    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('renders the explainer sections and footer without a second start CTA or h1 (AC-01, AC-03)', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('footer')).not.toBeNull();
    expect(compiled.querySelectorAll('h2').length).toBeGreaterThan(0);
    expect(compiled.querySelectorAll('h1').length).toBe(1);
    expect(compiled.querySelectorAll('button[aria-label="issuanceInfo.cta.ariaLabel"]').length).toBe(1);
  });
});
