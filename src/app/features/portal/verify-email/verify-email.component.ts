import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import {
  ApiProblemError,
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
import { DATA_PATH, QR_PATH } from '../../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { CodeInputComponent } from '../../../shared/components/code-input/code-input.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { injectCountdown } from '../../../shared/countdown';

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

/**
 * Paso Verificar correo (wireframes, Verificar correo; design.md de la
 * interfaz §3.4): muestra el correo al que el servicio envió el código, pide
 * los 6 dígitos y los comprueba al completarlos; con el correo verificado va a
 * QR (generando), que confirma. Reenviar espera a `resend_available_at`.
 * Cambiar el correo y el botón atrás vuelven a Datos. Con el límite de envíos
 * agotado, Volver al inicio retira el recorrido sin pedir confirmación. El
 * correo y la cuenta atrás salen de `GET /journey`: nada se guarda en el
 * navegador (AC-09). La ruta la protege `journeyStepGuard`.
 */
@Component({
  selector: 'app-verify-email',
  imports: [TranslatePipe, CodeInputComponent, ConfirmDialogComponent],
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

  protected readonly verification = signal<EmailVerification | null>(null);
  protected readonly loading = signal(true);
  protected readonly checking = signal(false);
  protected readonly sending = signal(false);
  protected readonly cancelOpen = signal(false);
  protected readonly withdrawing = signal(false);
  private readonly feedback = signal<Exclude<Message, 'noMoreCodes'> | null>(null);
  /** El código ya no sirve (caducado o con los intentos agotados). */
  private readonly codeRejected = signal(false);
  /** El servicio dijo `too_many_codes` al enviar. */
  private readonly sendLimitReached = signal(false);
  /** Hasta cuándo no se puede pedir otro envío: `resend_available_at` o `Retry-After`. */
  protected readonly resend = injectCountdown();
  /** Hasta cuándo vale el código pendiente. */
  private readonly expiry = injectCountdown();

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
          if (!verification || verification.verified) {
            // La guarda ya lo ha comprobado: solo una carrera con otra pestaña llega aquí.
            void this.router.navigate(stepUrl(journey));
            return;
          }
          this.apply(verification);
          if (this.expiry.seconds() === 0 && verification.sends_left > 0) {
            this.feedback.set('expired');
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

  /** Los 6 dígitos están puestos (escritos, pegados o autocompletados): se comprueba el código. */
  protected onCode(code: string): void {
    if (this.checking()) {
      return;
    }
    this.checking.set(true);
    this.feedback.set(null);
    this.journeyApi.checkEmailCode({ code }).subscribe({
      // Si la guarda de QR no deja pasar, el titular sigue aquí y puede volver a intentarlo.
      next: () => void this.router.navigate(['/', QR_PATH]).finally(() => this.checking.set(false)),
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
        error: (error: unknown) => this.onSendError(error),
      });
  }

  /** `step_not_allowed` y `journey_closed` los resuelve el interceptor de EUD-287. */
  private onSendError(error: unknown): void {
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

  /** Cambiar el correo: Datos, con el correo escrito (AC-07). */
  protected onChangeEmail(): void {
    void this.router.navigate(['/', DATA_PATH]);
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
