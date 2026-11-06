import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { AttestationPreview, JourneyApi } from '../../../core/api/generated/journey';
import { JourneyNavigator, isJourneyClosed } from '../../../core/journey/journey-navigator';
import { QR_PATH } from '../../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { JourneyIssuanceStore } from '../../journey-issuance/journey-issuance.store';

/**
 * Paso Datos (wireframes, Datos): la vista previa de la atestación tal como
 * la devuelve `GET /journey`, sin etiquetas fijas por tenant, y el correo,
 * siempre visible y rellenado si se conoce (prd.md FR-04, FR-05). Continuar
 * guarda el correo en memoria y va a QR, que pide la confirmación. Cancelar
 * pide confirmación y retira el recorrido. La ruta la protege `journeyStepGuard`.
 */
@Component({
  selector: 'app-user-data',
  imports: [ReactiveFormsModule, TranslatePipe, ConfirmDialogComponent],
  templateUrl: './user-data.component.html',
})
export class UserDataComponent implements OnInit {
  private readonly journeyApi = inject(JourneyApi);
  private readonly navigator = inject(JourneyNavigator);
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly store = inject(JourneyIssuanceStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly attestation = signal<AttestationPreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly cancelOpen = signal(false);
  protected readonly withdrawing = signal(false);
  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email, (control) => this.rejectedByService(control)],
  });

  /** El correo que el servicio rechazó (400) sigue sin ser válido hasta que el titular lo cambie (ac.md ES-04). */
  private rejectedByService(control: AbstractControl<string>): ValidationErrors | null {
    return this.store.emailRejected() && control.value === this.store.email() ? { rejected: true } : null;
  }

  ngOnInit(): void {
    this.journeyApi
      .getJourney()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (journey) => this.show(journey.attestation ?? null),
        // GET /journey no pasa por el interceptor de 409 y 410 (EUD-287).
        error: (error: unknown) =>
          void (isJourneyClosed(error) ? this.navigator.toSessionExpired() : this.router.navigate(['/'])),
      });
  }

  /** El correo que ya escribió el titular (al volver de QR) manda sobre el que conoce el servicio. */
  private show(attestation: AttestationPreview | null): void {
    this.attestation.set(attestation);
    this.email.setValue(this.store.email() ?? attestation?.email ?? '');
    if (this.store.emailRejected()) {
      this.email.markAsTouched();
    }
    this.loading.set(false);
  }

  protected onContinue(): void {
    if (this.email.invalid) {
      return;
    }
    this.store.confirm(this.email.value.trim());
    void this.router.navigate(['/', QR_PATH]);
  }

  protected onCancel(): void {
    this.cancelOpen.set(true);
  }

  protected onKeepGoing(): void {
    this.cancelOpen.set(false);
  }

  /**
   * «Sí, cancelar»: retira el recorrido y descarta los tokens (design.md
   * §3.1, punto 7). Si la retirada falla, los tokens se descartan igual y el
   * recorrido caduca en el servicio (ac.md ES-05). Con un 410, el interceptor
   * ya lleva a la sesión caducada.
   */
  protected onConfirmCancel(): void {
    if (this.withdrawing()) {
      return;
    }
    this.withdrawing.set(true);
    this.cancelOpen.set(false);
    this.journeyApi
      .withdrawJourney()
      .pipe(finalize(() => this.withdrawing.set(false)))
      .subscribe({
        next: () => this.leave(),
        error: (error: unknown) => (isJourneyClosed(error) ? this.store.clear() : this.leave()),
      });
  }

  private leave(): void {
    this.store.clear();
    this.session.discardTokens();
    void this.router.navigate(['/']);
  }
}
