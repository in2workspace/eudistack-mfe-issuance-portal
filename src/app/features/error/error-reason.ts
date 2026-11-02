import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Ruta de la pantalla de error única (wireframes, Error): `error/<caso>`. */
export const ERROR_PATH = 'error';

/**
 * Casos de la pantalla de error (prd.md §3.4). Cada uno tiene sus textos en
 * `error.<caso>.*`.
 */
export const ERROR_REASONS = [
  'identification-failed',
  'not-entitled',
  'source-unavailable',
  'issuance-failed',
  'onboarding-unavailable',
  'offer-not-renewable',
  'session-expired',
] as const;

export type ErrorReason = (typeof ERROR_REASONS)[number];

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
