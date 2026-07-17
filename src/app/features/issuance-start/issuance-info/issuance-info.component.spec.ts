import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IssuanceInfoComponent } from './issuance-info.component';
import { IssuanceStartService } from '../issuance-start.service';
import { CannotContinueReason } from '../cannot-continue-reason';

describe('IssuanceInfoComponent', () => {
  let fixture: ComponentFixture<IssuanceInfoComponent>;
  let reasonSignal: WritableSignal<CannotContinueReason | null>;
  let issuanceStartService: Pick<IssuanceStartService, 'start' | 'retry' | 'cannotContinueReason'> & {
    start: jest.Mock;
    retry: jest.Mock;
  };

  // Uses a real Angular signal (not a plain jest.fn) so the component's
  // `computed()` can track it as a reactive dependency, exactly as it would
  // against the real IssuanceStartService.cannotContinueReason.
  function configure(initialReason: CannotContinueReason | null): void {
    reasonSignal = signal(initialReason);
    issuanceStartService = {
      start: jest.fn(),
      retry: jest.fn(() => reasonSignal.set(null)),
      cannotContinueReason: reasonSignal.asReadonly(),
    };

    TestBed.configureTestingModule({
      imports: [IssuanceInfoComponent, TranslateModule.forRoot()],
      providers: [{ provide: IssuanceStartService, useValue: issuanceStartService }],
    });

    fixture = TestBed.createComponent(IssuanceInfoComponent);
    fixture.detectChanges();
  }

  it('default state renders info + a single visible CTA with clear action text (AC-01, AC-04)', () => {
    configure(null);

    const compiled = fixture.nativeElement as HTMLElement;
    const headings = compiled.querySelectorAll('h1');
    const buttons = compiled.querySelectorAll('button');

    expect(headings.length).toBe(1);
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent?.trim().length).toBeGreaterThan(0);
  });

  it('CTA invokes IssuanceStartService.start()', () => {
    configure(null);

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector('button')?.click();

    expect(issuanceStartService.start).toHaveBeenCalledTimes(1);
  });

  it('"cannot continue" state renders a generic notice + Retry without leaking internal detail (AC-05, ES-01)', () => {
    configure(CannotContinueReason.Unknown);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('h1').length).toBe(1);
    expect(compiled.textContent).not.toContain(CannotContinueReason.Unknown);
    const buttons = compiled.querySelectorAll('button');
    expect(buttons.length).toBe(1);
  });

  it('resolves deterministically to a single state when a new error arrives concurrently with retry, never CTA + notice together (ES-04)', () => {
    configure(CannotContinueReason.Unknown);

    // Retry clears the reason, but a new error signal lands in the same tick.
    fixture.componentInstance.onRetry();
    reasonSignal.set(CannotContinueReason.Unknown);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('h1').length).toBe(1);
    expect(compiled.querySelectorAll('button').length).toBe(1);
    expect(fixture.componentInstance.cannotContinue()).toBe(true);
  });

  it('Retry discards the error and returns to the informative state (AC-06)', () => {
    configure(CannotContinueReason.Unknown);

    fixture.componentInstance.onRetry();
    fixture.detectChanges();

    expect(issuanceStartService.retry).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.cannotContinue()).toBe(false);
  });
});
