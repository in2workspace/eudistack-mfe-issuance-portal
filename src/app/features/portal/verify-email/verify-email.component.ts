import { Component, DestroyRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
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
  EXPIRED_CODE,
  INVALID_CODE,
  JOURNEY_CLOSED,
  RESEND_TOO_SOON,
  STEP_NOT_ALLOWED,
  TOO_MANY_ATTEMPTS,
  TOO_MANY_CODES,
  TOO_MANY_REQUESTS,
} from '../../../core/api/api-problem.error';
import { EmailVerification, JourneyApi } from '../../../core/api/generated/journey';
import { TenantLanguageService } from '../../../core/branding/tenant-language.service';
import { JourneyIssuanceStore } from '../../../core/journey/journey-issuance.store';
import { JourneyNavigator, isJourneyClosed, stepUrl } from '../../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { StepBackService } from '../../../shared/components/step-indicator/step-back.service';
import { CodeInputComponent } from '../../../shared/components/code-input/code-input.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { injectCountdown } from '../../../shared/countdown';
import { StepIndicatorComponent } from '../../../shared/components/step-indicator/step-indicator.component';

/** Mensaje bajo las casillas del código, anunciado en una región `aria-live="polite"`. */
type Message =
  | 'invalid'
  | 'expired'
  | 'resent'
  | 'unavailable'
  | 'generic'
  | 'tooManyRequests'
  | 'tooManyRequestsLater'
  | 'noMoreCodes';

/** Por qué no ha salido el código desde el estado del correo (design.md §3.2). */
type SendProblem = 'unavailable' | 'tooManyRequests' | 'tooManyRequestsLater' | 'resendTooSoon' | 'noMoreCodes';

/** Los dos estados de Correo (design.md §3.4, punto 1): el correo y el código. */
type Stage = 'email' | 'code';

/**
 * Formato de correo sin contar los espacios de los extremos, que se quitan al
 * enviar: un correo autocompletado con un espacio al final es válido
 * (review N3).
 */
function trimmedEmail(control: AbstractControl<string>): ValidationErrors | null {
  return Validators.email({ value: control.value.trim() } as AbstractControl);
}

/**
 * Paso Correo (wireframes, Correo; design.md de la interfaz §3.4), una sola
 * ruta con dos estados. Estado 1, el correo: rellenado con el que conoce el
 * servicio (`known_email`) o con el último al que se envió un código; Enviarme
 * un código lo envía, también si venía rellenado, y pasa al estado 2. Estado 2,
 * el código: muestra el correo al que se envió, pide los 6 dígitos y los
 * comprueba al completarlos; con el correo verificado va al paso que dice el
 * servicio: Solicitudes, o Datos de la única solicitud (prd.md FR-13, FR-14).
 * Reenviar espera a `resend_available_at`. Cambiar el correo vuelve al estado
 * 1 con el correo escrito. Con el límite de envíos agotado, Volver al inicio
 * retira el recorrido sin pedir confirmación; Cancelar lo pide. El correo y la
 * cuenta atrás salen de `GET /journey`: nada se guarda en el navegador
 * (AC-09). La ruta la protege `journeyStepGuard`.
 */
@Component({
  selector: 'app-verify-email',
  imports: [ReactiveFormsModule, TranslatePipe, CodeInputComponent, ConfirmDialogComponent, StepIndicatorComponent],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnInit {
  private readonly journeyApi = inject(JourneyApi);
  private readonly navigator = inject(JourneyNavigator);
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly store = inject(JourneyIssuanceStore);
  private readonly language = inject(TenantLanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly codeInput = viewChild(CodeInputComponent);
  private readonly headerBack = inject(StepBackService);

  protected readonly stage = signal<Stage>('email');
  protected readonly verification = signal<EmailVerification | null>(null);
  protected readonly loading = signal(true);
  protected readonly checking = signal(false);
  protected readonly sending = signal(false);
  protected readonly cancelOpen = signal(false);
  protected readonly withdrawing = signal(false);
  private readonly feedback = signal<Exclude<Message, 'noMoreCodes'> | null>(null);
  /** El código ya no sirve (caducado o con los intentos agotados). */
  private readonly codeRejected = signal(false);
  /** El servicio dijo `too_many_codes` al enviar desde el estado del código. */
  private readonly sendLimitReached = signal(false);
  /** Hasta cuándo no se puede pedir otro envío: `resend_available_at` o `Retry-After`. */
  protected readonly resend = injectCountdown();
  /** Hasta cuándo vale el código pendiente. */
  private readonly expiry = injectCountdown();

  /** Por qué no ha salido el código desde el estado del correo. */
  protected readonly sendProblem = signal<SendProblem | null>(null);
  /** Cuenta atrás del `Retry-After` de un envío rechazado desde el estado del correo. */
  protected readonly retry = injectCountdown();
  /** El correo que el servicio rechazó (400) sigue sin ser válido hasta que el titular lo cambie (ac.md ES-01). */
  private readonly rejectedEmail = signal<string | null>(null);
  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, trimmedEmail, (control) => this.rejectedByService(control)],
  });

  constructor() {
    // Wireframes: el botón de volver de la cabecera sale mientras se espera el código y vuelve al estado del correo.
    effect(() => {
      if (this.stage() === 'code') {
        this.headerBack.set(() => this.onChangeEmail());
      } else {
        this.headerBack.clear();
      }
    });
    this.destroyRef.onDestroy(() => this.headerBack.clear());
  }

  private rejectedByService(control: AbstractControl<string>): ValidationErrors | null {
    return control.value.trim() === this.rejectedEmail() ? { rejected: true } : null;
  }

  /** Sin envíos que quedar y sin un código que valga: el titular empieza de nuevo (AC-05). */
  protected readonly noMoreCodes = computed(() => {
    const verification = this.verification();
    const unusable = this.codeRejected() || this.expiry.seconds() === 0;
    return this.sendLimitReached() || (verification !== null && verification.sends_left === 0 && unusable);
  });

  protected readonly message = computed<Message | null>(() => {
    if (this.noMoreCodes()) {
      return 'noMoreCodes';
    }
    const feedback = this.feedback();
    return feedback === 'tooManyRequests' && this.resend.seconds() === 0 ? null : feedback;
  });

  protected readonly messageIsError = computed(() => {
    const message = this.message();
    return message !== null && message !== 'resent';
  });

  ngOnInit(): void {
    this.journeyApi
      .getJourney()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (journey) => {
          const verification = journey.email_verification;
          if (verification?.verified) {
            // La guarda ya lo ha comprobado: solo una carrera con otra pestaña llega aquí.
            void this.router.navigate(stepUrl(journey));
            return;
          }
          if (verification) {
            this.apply(verification);
            this.stage.set('code');
            if (this.expiry.seconds() === 0 && verification.sends_left > 0) {
              this.feedback.set('expired');
            }
          } else {
            this.email.setValue(journey.known_email ?? '');
          }
          this.loading.set(false);
        },
        // GET /journey no pasa por el interceptor de 409 y 410 (EUD-287).
        error: (error: unknown) =>
          void (isJourneyClosed(error) ? this.navigator.toSessionExpired() : this.router.navigate(['/'])),
      });
  }

  private apply(verification: EmailVerification): void {
    this.verification.set(verification);
    this.resend.until(Date.parse(verification.resend_available_at));
    this.expiry.until(verification.code_expires_at ? Date.parse(verification.code_expires_at) : 0);
    this.codeRejected.set(false);
  }

  /** Estado 1, Enviarme un código: envía el código al correo y pasa al estado 2. */
  protected onSendCode(): void {
    if (this.email.invalid || this.sending() || this.retry.seconds() > 0 || this.sendProblem() === 'noMoreCodes') {
      return;
    }
    this.sending.set(true);
    this.sendProblem.set(null);
    this.journeyApi
      .sendEmailCode({ email: this.email.value.trim() }, this.language.current() || undefined)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (sent) => this.showCodeStage(sent),
        error: (error: unknown) => this.onEmailSendError(error),
      });
  }

  private showCodeStage(verification: EmailVerification): void {
    this.apply(verification);
    this.feedback.set(null);
    this.sendLimitReached.set(false);
    this.stage.set('code');
  }

  /**
   * `resend_too_soon` y `too_many_codes` no son fallos si ya hay un código
   * pendiente para este mismo correo: el estado del código lo dice. Si el
   * correo es otro, el titular se queda en el estado del correo con la espera
   * o con Volver al inicio. `step_not_allowed` y `journey_closed` los resuelve
   * el interceptor de EUD-287.
   */
  private onEmailSendError(error: unknown): void {
    const problem = error instanceof ApiProblemError ? error : undefined;
    switch (problem?.type) {
      case RESEND_TOO_SOON:
      case TOO_MANY_CODES:
        if (this.hasPendingCodeForTypedEmail()) {
          this.stage.set('code');
          return;
        }
        this.showCannotSendYet(problem.type, problem.retryAfterSeconds);
        return;
      case EMAIL_REQUIRED:
      case EMAIL_INVALID:
        this.rejectedEmail.set(this.email.value.trim());
        this.email.updateValueAndValidity();
        this.email.markAsTouched();
        return;
      case TOO_MANY_REQUESTS:
        if (problem.retryAfterSeconds === undefined) {
          this.sendProblem.set('tooManyRequestsLater');
        } else {
          this.retry.startFor(problem.retryAfterSeconds);
          this.sendProblem.set('tooManyRequests');
        }
        return;
      case STEP_NOT_ALLOWED:
      case JOURNEY_CLOSED:
        return;
      case EMAIL_UNAVAILABLE:
      default:
        this.sendProblem.set('unavailable');
    }
  }

  private hasPendingCodeForTypedEmail(): boolean {
    const verification = this.verification();
    return verification !== null && !verification.verified && verification.email === this.email.value.trim();
  }

  private showCannotSendYet(type: string, retryAfterSeconds: number | undefined): void {
    if (type === TOO_MANY_CODES) {
      this.sendProblem.set('noMoreCodes');
    } else if (retryAfterSeconds === undefined) {
      this.sendProblem.set('tooManyRequestsLater');
    } else {
      this.retry.startFor(retryAfterSeconds);
      this.sendProblem.set('resendTooSoon');
    }
  }

  /** Los 6 dígitos están puestos (escritos, pegados o autocompletados): se comprueba el código. */
  protected onCode(code: string): void {
    if (this.checking()) {
      return;
    }
    this.checking.set(true);
    this.feedback.set(null);
    this.journeyApi.checkEmailCode({ code }).subscribe({
      // Con el correo verificado el paso lo dice el recorrido (AD-8); si la guarda no deja pasar, el titular sigue aquí.
      next: (journey) => void this.router.navigate(stepUrl(journey)).finally(() => this.checking.set(false)),
      error: (error: unknown) => {
        this.checking.set(false);
        this.onCheckError(error);
      },
    });
  }

  /** `step_not_allowed` y `journey_closed` los resuelve el interceptor de EUD-287. */
  private onCheckError(error: unknown): void {
    const type = error instanceof ApiProblemError ? error.type : undefined;
    if (type === STEP_NOT_ALLOWED || type === JOURNEY_CLOSED) {
      return;
    }
    if (type === INVALID_CODE) {
      this.feedback.set('invalid');
    } else if (type === EXPIRED_CODE || type === TOO_MANY_ATTEMPTS) {
      this.codeRejected.set(true);
      this.feedback.set('expired');
    } else {
      this.feedback.set('generic');
    }
    this.codeInput()?.clear();
  }

  protected onResend(): void {
    const verification = this.verification();
    if (!verification || this.sending() || this.resend.seconds() > 0) {
      return;
    }
    this.sending.set(true);
    this.journeyApi
      .sendEmailCode({ email: verification.email }, this.language.current() || undefined)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (sent) => {
          this.apply(sent);
          this.feedback.set('resent');
          this.codeInput()?.clear();
        },
        error: (error: unknown) => this.onResendError(error),
      });
  }

  /** `step_not_allowed` y `journey_closed` los resuelve el interceptor de EUD-287. */
  private onResendError(error: unknown): void {
    const problem = error instanceof ApiProblemError ? error : undefined;
    switch (problem?.type) {
      case STEP_NOT_ALLOWED:
      case JOURNEY_CLOSED:
        return;
      case RESEND_TOO_SOON:
        this.waitFor(problem.retryAfterSeconds);
        this.feedback.set(null);
        return;
      case TOO_MANY_CODES:
        this.sendLimitReached.set(true);
        return;
      case TOO_MANY_REQUESTS:
        this.waitFor(problem.retryAfterSeconds);
        this.feedback.set(problem.retryAfterSeconds === undefined ? 'tooManyRequestsLater' : 'tooManyRequests');
        return;
      case EMAIL_UNAVAILABLE:
      default:
        this.feedback.set('unavailable');
    }
  }

  private waitFor(seconds: number | undefined): void {
    if (seconds !== undefined) {
      this.resend.startFor(seconds);
    }
  }

  /** Cambiar el correo: vuelve al estado 1 con el correo al que se envió el código (AC-07). */
  protected onChangeEmail(): void {
    this.email.setValue(this.verification()?.email ?? '');
    this.sendProblem.set(null);
    this.stage.set('email');
  }

  protected onCancel(): void {
    this.cancelOpen.set(true);
  }

  protected onKeepGoing(): void {
    this.cancelOpen.set(false);
  }

  /**
   * «Sí, cancelar» y Volver al inicio: retira el recorrido y descarta los
   * tokens (design.md §3.1, punto 7). Si la retirada falla, los tokens se
   * descartan igual y el recorrido caduca en el servicio (ac.md ES-05). Con
   * un 410, el interceptor ya lleva a la sesión caducada.
   */
  protected onWithdraw(): void {
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
