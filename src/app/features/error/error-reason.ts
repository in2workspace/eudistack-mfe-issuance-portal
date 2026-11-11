import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Ruta de la pantalla de error única (wireframes, Error): `error/<caso>`. */
export const ERROR_PATH = 'error';

/**
 * Casos de la pantalla de error (prd.md §3.4). Cada uno tiene sus textos en
 * `error.<caso>.*`.
 */
export const ERROR_REASONS = [
  'config-unavailable',
  'identification-failed',
  'not-entitled',
  'source-unavailable',
  'issuance-failed',
  'onboarding-unavailable',
  'offer-not-renewable',
  'session-expired',
] as const;

export type ErrorReason = (typeof ERROR_REASONS)[number];

/**
 * Casos cuya acción principal es volver a intentarlo o generar un código
 * nuevo: ofrecen también «Volver al inicio», que termina el recorrido
 * (prd.md 1.5.0 §3.4, AC-20; EUD-286 decisión 8).
 */
export const RETRY_REASONS: readonly ErrorReason[] = [
  'identification-failed',
  'source-unavailable',
  'issuance-failed',
  'onboarding-unavailable',
];

export function isErrorReason(value: unknown): value is ErrorReason {
  return typeof value === 'string' && (ERROR_REASONS as readonly string[]).includes(value);
}

/** Dirección de la pantalla de error para un caso. */
export function errorUrl(reason: ErrorReason): string[] {
  return ['/', ERROR_PATH, reason];
}

/** Un caso que no es ninguno de los conocidos lleva a Inicio (EC-03). */
export const errorReasonGuard: CanActivateFn = (route) =>
  isErrorReason(route.paramMap.get('reason')) ? true : inject(Router).createUrlTree(['/']);
