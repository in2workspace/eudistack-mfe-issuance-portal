import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import {
  ApiProblemError,
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  EMAIL_UNAVAILABLE,
  JOURNEY_CLOSED,
  RESEND_TOO_SOON,
  STEP_NOT_ALLOWED,
  TOO_MANY_CODES,
  TOO_MANY_REQUESTS,
} from '../../../core/api/api-problem.error';
import { AttestationPreview, JourneyApi } from '../../../core/api/generated/journey';
import { TenantLanguageService } from '../../../core/branding/tenant-language.service';
import { JourneyNavigator, isJourneyClosed } from '../../../core/journey/journey-navigator';
import { EMAIL_PATH } from '../../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { injectCountdown } from '../../../shared/countdown';
import { JourneyIssuanceStore } from '../../../core/journey/journey-issuance.store';

/** Por qué no ha salido el código, para mostrarlo en Datos (design.md §3.2). */
type SendProblem = 'unavailable' | 'tooManyRequests' | 'tooManyRequestsLater';

/**
 * Formato de correo sin contar los espacios de los extremos, que se quitan al
 * confirmar: un correo autocompletado con un espacio al final es válido
 * (review N3).
 */
function trimmedEmail(control: AbstractControl<string>): ValidationErrors | null {
  return Validators.email({ value: control.value.trim() } as AbstractControl);
}

/**
 * Paso Datos (wireframes, Datos): la vista previa de la atestación tal como
 * la devuelve `GET /journey`, sin etiquetas fijas por tenant, y el correo,
 * siempre visible y rellenado si se conoce (prd.md FR-04, FR-05). Continuar
 * pide al servicio que envíe un código a ese correo y va a Verificar correo;
 * si no puede enviarlo, lo dice aquí. Cancelar pide confirmación y retira el
 * recorrido. La ruta la protege `journeyStepGuard`.
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
  private readonly language = inject(TenantLanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly attestation = signal<AttestationPreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly cancelOpen = signal(false);
  protected readonly withdrawing = signal(false);
  /** Continuar está enviando el código o yendo a Verificar correo: una segunda pulsación no envía otro (ac.md EC-07). */
  protected readonly continuing = signal(false);
  protected readonly sendProblem = signal<SendProblem | null>(null);
  /** Cuenta atrás del `Retry-After` de `too_many_requests`. */
  protected readonly retry = injectCountdown();
  /** El correo que el servicio rechazó (400) sigue sin ser válido hasta que el titular lo cambie (ac.md ES-01). */
  private readonly rejectedEmail = signal<string | null>(null);
  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, trimmedEmail, (control) => this.rejectedByService(control)],
  });

  private rejectedByService(control: AbstractControl<string>): ValidationErrors | null {
    return control.value.trim() === this.rejectedEmail() ? { rejected: true } : null;
  }

  ngOnInit(): void {
    this.journeyApi
      .getJourney()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (journey) => this.show(journey.attestation ?? null, journey.email_verification?.email),
        // GET /journey no pasa por el interceptor de 409 y 410 (EUD-287).
        error: (error: unknown) =>
          void (isJourneyClosed(error) ? this.navigator.toSessionExpired() : this.router.navigate(['/'])),
      });
  }

  /** El correo al que se envió el código (al volver de Verificar correo) manda sobre el que conoce la fuente. */
  private show(attestation: AttestationPreview | null, sentTo: string | undefined): void {
    this.attestation.set(attestation);
    this.email.setValue(sentTo ?? attestation?.email ?? '');
    this.loading.set(false);
  }

  protected onContinue(): void {
    if (this.email.invalid || this.continuing() || this.retry.seconds() > 0) {
      return;
    }
    this.continuing.set(true);
    this.sendProblem.set(null);
    this.journeyApi
      .sendEmailCode({ email: this.email.value.trim() }, this.language.current() || undefined)
      .subscribe({
        // Si la guarda no deja pasar, el titular sigue en Datos y puede volver a intentarlo.
        next: () => this.toVerifyEmail(),
        error: (error: unknown) => this.onSendError(error),
      });
  }

  private toVerifyEmail(): void {
    void this.router.navigate(['/', EMAIL_PATH]).finally(() => this.continuing.set(false));
  }

  /**
   * `resend_too_soon` y `too_many_codes` no son fallos aquí: ya hay un código
   * pendiente o no caben más, y Verificar correo lo dice. `step_not_allowed` y
   * `journey_closed` los resuelve el interceptor de EUD-287.
   */
  private onSendError(error: unknown): void {
    const problem = error instanceof ApiProblemError ? error : undefined;
    switch (problem?.type) {
      case RESEND_TOO_SOON:
      case TOO_MANY_CODES:
        this.toVerifyEmail();
        return;
      case EMAIL_REQUIRED:
      case EMAIL_INVALID:
        this.rejectedEmail.set(this.email.value.trim());
        this.email.updateValueAndValidity();
        this.email.markAsTouched();
        break;
      case TOO_MANY_REQUESTS:
        if (problem.retryAfterSeconds === undefined) {
          this.sendProblem.set('tooManyRequestsLater');
        } else {
          this.retry.startFor(problem.retryAfterSeconds);
          this.sendProblem.set('tooManyRequests');
        }
        break;
      case STEP_NOT_ALLOWED:
      case JOURNEY_CLOSED:
        break;
      case EMAIL_UNAVAILABLE:
      default:
        this.sendProblem.set('unavailable');
    }
    this.continuing.set(false);
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
