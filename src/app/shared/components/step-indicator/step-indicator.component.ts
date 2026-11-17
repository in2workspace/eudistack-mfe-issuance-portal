import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * «Paso X de 3» above the title of Correo, Datos and QR (wireframes, Navegación): the three screens where
 * the holder has to act.
 */
@Component({
  selector: 'app-step-indicator',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-sm font-medium text-gray-500" data-testid="step-indicator">
      {{ 'stepIndicator.label' | translate: { step: step(), total: total() } }}
    </p>
  `,
})
export class StepIndicatorComponent {
  readonly step = input.required<number>();
  readonly total = input(3);
}
