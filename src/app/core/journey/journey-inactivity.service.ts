import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { JourneyNavigator, isJourneyClosed } from './journey-navigator';
import { DATA_PATH, EMAIL_PATH, ENTITLEMENT_PATH, QR_PATH } from './journey-paths';

const STEP_PATHS: readonly string[] = [ENTITLEMENT_PATH, DATA_PATH, EMAIL_PATH, QR_PATH];

/**
 * Aviso de caducidad del recorrido (prd.md §3.3, punto 4): el servicio lo
 * retira tras 15 minutos sin peticiones (design.md del servicio, AD-4), así
 * que el temporizador se reinicia con cada llamada al servicio, no con los
 * clics. Al vencer en un paso del recorrido, la referencia es la respuesta
 * de `GET /journey`: con 410 se muestra la sesión caducada. Fuera de los
 * pasos (Inicio, Ayuda, Error) no hay recorrido que vigilar.
 */
@Injectable({ providedIn: 'root' })
export class JourneyInactivityService implements OnDestroy {
  static readonly INACTIVITY_MS = 15 * 60 * 1000;
  /**
   * La comprobación cuenta como actividad en el servicio. Si llegara justo a
   * los 15 minutos de enviar la última petición, el servicio podría ver algo
   * menos (actualiza `last_activity` al procesarla) y renovar el recorrido
   * en lugar de darlo por caducado. Se espera además un minuto, la cadencia
   * del proceso de retirada del servicio.
   */
  static readonly PROBE_MARGIN_MS = 60 * 1000;

  private readonly router = inject(Router);
  private readonly journeyApi = inject(JourneyApi);
  private readonly navigator = inject(JourneyNavigator);
  private readonly accessToken = inject(ISSUANCE_PORTAL_ACCESS_TOKEN);

  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Hubo una llamada al servicio: vuelve a contar los 15 minutos (más el margen). */
  touch(): void {
    this.clear();
    this.timer = setTimeout(
      () => void this.onInactive(),
      JourneyInactivityService.INACTIVITY_MS + JourneyInactivityService.PROBE_MARGIN_MS,
    );
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private async onInactive(): Promise<void> {
    this.timer = null;
    if (!this.accessToken() || !this.onJourneyStep()) {
      return;
    }
    try {
      await firstValueFrom(this.journeyApi.getJourney());
    } catch (error: unknown) {
      if (isJourneyClosed(error)) {
        await this.navigator.toSessionExpired();
      }
    }
  }

  private onJourneyStep(): boolean {
    const path = this.router.parseUrl(this.router.url).root.children['primary']?.segments[0]?.path;
    return path !== undefined && STEP_PATHS.includes(path);
  }

  private clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
