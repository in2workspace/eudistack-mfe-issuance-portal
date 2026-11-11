import { DestroyRef, NgZone, Signal, computed, inject, signal } from '@angular/core';
import { formatCountdown } from '../features/credential-offer/credential-offer-expiry';

/** Cuenta atrás hasta un instante, para los plazos que da el servicio (reenvío del código, `Retry-After`). */
export interface Countdown {
  /** Segundos enteros que quedan, 0 cuando llega el instante o no hay ninguno. */
  readonly seconds: Signal<number>;
  /** Lo que queda como «mm:ss». */
  readonly text: Signal<string>;
  /** Cuenta hasta el instante dado, en milisegundos desde la época. */
  until(instant: number): void;
  /** Cuenta los segundos dados desde ahora. */
  startFor(seconds: number): void;
}

/** Crea una cuenta atrás que se actualiza cada segundo y se para al destruirse quien la inyecta. */
export function injectCountdown(): Countdown {
  const now = signal(Date.now());
  const target = signal(0);
  // Fuera de la zona: un temporizador periódico en ella impediría que la aplicación se diera por estable.
  const timer = inject(NgZone).runOutsideAngular(() => setInterval(() => now.set(Date.now()), 1000));
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  const seconds = computed(() => {
    const left = Math.ceil((target() - now()) / 1000);
    return Number.isFinite(left) ? Math.max(left, 0) : 0;
  });
  const until = (instant: number): void => {
    now.set(Date.now());
    target.set(instant);
  };
  return {
    seconds,
    text: computed(() => formatCountdown(seconds())),
    until,
    startFor: (secondsToWait) => until(Date.now() + secondsToWait * 1000),
  };
}
