import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { IssuanceInfoComponent } from './issuance-info.component';
import { IssuanceStartService } from '../issuance-start.service';

expect.extend(toHaveNoViolations);

describe('IssuanceInfoComponent a11y', () => {
  let fixture: ComponentFixture<IssuanceInfoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IssuanceInfoComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: IssuanceStartService,
          useValue: { start: jest.fn(), retry: jest.fn(), cannotContinueReason: () => null },
        },
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(IssuanceInfoComponent);
    fixture.detectChanges();
  });

  it('the CTA is a native <button> — keyboard-operable via Enter/Space by browser semantics (EC-01)', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('the CTA exposes an accessible name via aria-label (AC-03)', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
  });

  it('the screen uses a single h1', () => {
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');

    expect(headings.length).toBe(1);
  });

  it('the CTA declares a >=44x44px touch target via design tokens (structural check; real layout is not computable in jsdom)', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.className).toMatch(/min-h-\[44px\]/);
    expect(button?.className).toMatch(/min-w-\[44px\]/);
  });

  it('has no automatically detectable structural a11y violations (jest-axe)', async () => {
    const results = await axe(fixture.nativeElement);

    expect(results).toHaveNoViolations();
  });
});
