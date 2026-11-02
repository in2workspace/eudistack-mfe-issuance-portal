import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, map, of, timeout } from 'rxjs';
import { ConfigurationApi, PortalConfig } from '../api/generated/journey';
import { validatePortalConfig } from './validate-portal-config';

export type PortalConfigState =
  | { status: 'loading' }
  | { status: 'loaded'; config: PortalConfig }
  | { status: 'unavailable' };

/**
 * Configuración del portal del tenant, de `GET /config` (design.md, prd.md
 * FR-02). El tenant lo resuelve el servicio por el host: la interfaz no lo
 * calcula. Sin respuesta en 3 s, con un error o con una forma inválida, el
 * estado es `unavailable` (prd.md §3.4).
 */
@Injectable({ providedIn: 'root' })
export class PortalConfigService {
  /** Presupuesto de tiempo para no bloquear el primer render. */
  static readonly REQUEST_TIMEOUT_MS = 3_000;

  private readonly api = inject(ConfigurationApi);
  private readonly _state = signal<PortalConfigState>({ status: 'loading' });

  readonly state = this._state.asReadonly();
  readonly config = computed(() => {
    const state = this._state();
    return state.status === 'loaded' ? state.config : null;
  });

  async load(): Promise<PortalConfigState> {
    this._state.set({ status: 'loading' });
    const config = await firstValueFrom(
      this.api.getPortalConfig().pipe(
        timeout(PortalConfigService.REQUEST_TIMEOUT_MS),
        map((raw) => validatePortalConfig(raw)),
        catchError(() => of(null)),
      ),
    );
    const state: PortalConfigState = config ? { status: 'loaded', config } : { status: 'unavailable' };
    this._state.set(state);
    return state;
  }
}
