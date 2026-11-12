import { Component, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationExtras, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiProblemError, CONFIG_UNAVAILABLE } from '../../core/api/api-problem.error';
import { JourneyApi } from '../../core/api/generated/journey';
import { HolderAuthService } from '../../core/auth/holder-auth.service';
import { CONFIG_UNAVAILABLE_PATH, SERVICE_CONFIG_UNAVAILABLE_STATE } from '../../core/guards/config-available.guard';
import { stepUrl } from '../../core/journey/journey-navigator';
import { errorUrl } from '../error/error-reason';

interface Destination {
  commands: string[];
  extras?: NavigationExtras;
}

const IDENTIFICATION_FAILED: Destination = { commands: errorUrl('identification-failed') };

/**
 * Vuelta del Verifier (design.md §3.1, puntos 2 a 4 y 6): canjea el código,
 * abre el recorrido con el Access Token y sigue al paso que dice el servicio,
 * que con un recorrido ya abierto (tras recargar o renovar) es el suyo.
 * Si el Verifier vuelve con un error, la validación falla o el servicio no
 * abre el recorrido, descarta los tokens y muestra la identificación no
 * completada. Dos casos son distintos: si el login sin interacción de la
 * recarga no pudo resolverse (`login_required`, `interaction_required`), sigue
 * con el login interactivo; y si el servicio da su configuración por
 * incompleta (503), muestra el error de configuración.
 * No pinta nada: la pantalla de destino es la siguiente.
 */
@Component({
  selector: 'app-login-callback',
  template: '',
})
export class LoginCallbackComponent implements OnInit {
  private readonly auth = inject(HolderAuthService);
  private readonly journeyApi = inject(JourneyApi);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  async ngOnInit(): Promise<void> {
    const destination = await this.destination();
    if (destination) {
      await this.router.navigate(destination.commands, { replaceUrl: true, ...destination.extras });
    }
  }

  /** A dónde ir; `null` si el titular sale hacia el Verifier y no hay nada que mostrar. */
  private async destination(): Promise<Destination | null> {
    const outcome = await this.auth.completeLogin(this.document.location.href);
    if (outcome === 'interaction-required') {
      this.auth.login();
      return null;
    }
    if (outcome === 'failed') {
      return IDENTIFICATION_FAILED;
    }
    try {
      return { commands: stepUrl(await firstValueFrom(this.journeyApi.openJourney())) };
    } catch (error: unknown) {
      this.auth.discard();
      return error instanceof ApiProblemError && error.type === CONFIG_UNAVAILABLE
        ? { commands: [`/${CONFIG_UNAVAILABLE_PATH}`], extras: { state: SERVICE_CONFIG_UNAVAILABLE_STATE } }
        : IDENTIFICATION_FAILED;
    }
  }
}
