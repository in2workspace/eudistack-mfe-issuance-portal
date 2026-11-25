import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StepBackService } from './step-back.service';

/**
 * «Paso X de 3» above the title of Correo, Datos and QR (wireframes, Navegación): the three screens where
 * the holder has to act. On its row, the back arrow of the screen when it has one (StepBackService) and, with
 * `cancelable`, Cancelar as an X in the top right corner of the card (Tech Lead decision, 2026-11-18: the
 * wireframes draw it as a button at the bottom; the behaviour, asking for confirmation, is the same).
 */
@Component({
  selector: 'app-step-indicator',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      @if (back.action(); as goBack) {
        <button
          type="button"
          (click)="goBack()"
          [attr.aria-label]="'stepIndicator.back' | translate"
          data-testid="step-back"
          class="-ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      }
      <p class="flex-1 text-sm font-medium text-gray-500" data-testid="step-indicator">
        {{ 'stepIndicator.label' | translate: { step: step(), total: total() } }}
      </p>
      @if (cancelable()) {
        <button
          type="button"
          (click)="cancelRequested.emit()"
          [disabled]="cancelDisabled()"
          [attr.aria-label]="'stepIndicator.cancel' | translate"
          data-testid="step-cancel"
          class="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      }
    </div>
  `,
})
export class StepIndicatorComponent {
  protected readonly back = inject(StepBackService);

  readonly step = input.required<number>();
  readonly total = input(3);
  /** Shows Cancelar as an X; the screen asks for confirmation on `cancelRequested`. */
  readonly cancelable = input(false);
  readonly cancelDisabled = input(false);
  /** Not named `cancel`: an output must not shadow a standard DOM event. */
  readonly cancelRequested = output<void>();
}
