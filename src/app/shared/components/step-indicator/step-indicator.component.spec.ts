import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StepBackService } from './step-back.service';
import { StepIndicatorComponent } from './step-indicator.component';

expect.extend(toHaveNoViolations);

@Component({
  imports: [StepIndicatorComponent],
  template: `<app-step-indicator [step]="2" [cancelable]="cancelable()" [cancelDisabled]="busy()" (cancelRequested)="cancelled = cancelled + 1" />`,
})
class HostComponent {
  readonly cancelable = signal(false);
  readonly busy = signal(false);
  cancelled = 0;
}

describe('StepIndicatorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const back = (): HTMLButtonElement | null => element().querySelector('[data-testid="step-back"]');
  const cancel = (): HTMLButtonElement | null => element().querySelector('[data-testid="step-cancel"]');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent, TranslateModule.forRoot()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      'stepIndicator.label': 'Paso {{step}} de {{total}}',
      'stepIndicator.back': 'Volver',
      'stepIndicator.cancel': 'Cancelar',
    });
    translate.use('es');
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('shows the step of three, without arrow or X by default', () => {
    expect(element().querySelector('[data-testid="step-indicator"]')?.textContent?.trim()).toBe('Paso 2 de 3');
    expect(back()).toBeNull();
    expect(cancel()).toBeNull();
  });

  it('shows the back arrow while the screen sets one, and it runs the screen action', () => {
    const action = jest.fn();
    TestBed.inject(StepBackService).set(action);
    fixture.detectChanges();

    expect(back()?.getAttribute('aria-label')).toBe('Volver');
    back()!.click();
    expect(action).toHaveBeenCalledTimes(1);

    TestBed.inject(StepBackService).clear();
    fixture.detectChanges();
    expect(back()).toBeNull();
  });

  it('with cancelable, shows Cancelar as an X that emits cancel, disabled while the screen is busy', () => {
    fixture.componentInstance.cancelable.set(true);
    fixture.detectChanges();

    expect(cancel()?.getAttribute('aria-label')).toBe('Cancelar');
    cancel()!.click();
    expect(fixture.componentInstance.cancelled).toBe(1);

    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(cancel()!.disabled).toBe(true);
  });

  it('has no accessibility violations with the arrow and the X', async () => {
    TestBed.inject(StepBackService).set(jest.fn());
    fixture.componentInstance.cancelable.set(true);
    fixture.detectChanges();

    expect(await axe(element())).toHaveNoViolations();
  });
});
