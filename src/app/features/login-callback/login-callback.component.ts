import { Component, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationExtras, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiProblemError, CONFIG_UNAVAILABLE } from '../../core/api/api-problem.error';
import { JourneyApi } from '../../core/api/generated/journey';
import { HolderAuthService } from '../../core/auth/holder-auth.service';
import { CONFIG_UNAVAILABLE_PATH, SERVICE_CONFIG_UNAVAILABLE_STATE } from '../../core/guards/config-available.guard';
import { stepUrl } from '../../core/journey/journey-navigator';
import { JOURNEY_STEP_ROOTS } from '../../core/journey/journey-paths';
import { errorUrl } from '../error/error-reason';

interface Destination {
  commands: string[] | UrlTree;
  extras?: NavigationExtras;
}

const IDENTIFICATION_FAILED: Destination = { commands: errorUrl('identification-failed') };

/**
 * Vuelta del Verifier (design.md §3.1, puntos 2 a 4 y 6): canjea el código,
 * abre el recorrido con el Access Token y sigue al paso que dice el servicio,
 * que con un recorrido ya abierto (tras recargar o renovar) es el suyo. Si el
 * titular salió de una pantalla del recorrido (recargó en los Datos o el QR de
 * una solicitud), vuelve a ella: la guarda de la ruta la comprueba contra
 * `GET /journey` (EC-06, EC-07).
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

  ngOnInit(): void {
    void this.handleReturn();
  }

  private async handleReturn(): Promise<void> {
    const destination = await this.destination();
    if (destination) {
      const extras = { replaceUrl: true, ...destination.extras };
      await (destination.commands instanceof UrlTree
        ? this.router.navigateByUrl(destination.commands, extras)
        : this.router.navigate(destination.commands, extras));
    }
  }

  /** A dónde ir; `null` si el titular sale hacia el Verifier y no hay nada que mostrar. */
  private async destination(): Promise<Destination | null> {
    // Antes de canjear el código: descartar la sesión por un fallo borra también esta ruta.
    const returnPath = this.auth.takeReturnPath() ?? undefined;
    const outcome = await this.auth.completeLogin(this.document.location.href);
    if (outcome === 'interaction-required') {
      this.auth.login(returnPath);
      return null;
    }
    if (outcome === 'failed') {
      return IDENTIFICATION_FAILED;
    }
    try {
      const journey = await firstValueFrom(this.journeyApi.openJourney());
      return { commands: this.stepToReturnTo(returnPath) ?? stepUrl(journey) };
    } catch (error: unknown) {
      this.auth.discard();
      return error instanceof ApiProblemError && error.type === CONFIG_UNAVAILABLE
        ? { commands: [`/${CONFIG_UNAVAILABLE_PATH}`], extras: { state: SERVICE_CONFIG_UNAVAILABLE_STATE } }
        : IDENTIFICATION_FAILED;
    }
  }

  /** La ruta a la que volver, solo si es de un paso del recorrido de esta interfaz. */
  private stepToReturnTo(path: string | undefined): UrlTree | null {
    if (!path?.startsWith('/') || path.startsWith('//')) {
      return null;
    }
    try {
      const url = this.router.parseUrl(path);
      const root = url.root.children['primary']?.segments[0]?.path;
      return root !== undefined && JOURNEY_STEP_ROOTS.includes(root) ? url : null;
    } catch {
      return null;
    }
  }
}
