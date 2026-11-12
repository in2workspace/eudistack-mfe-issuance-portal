import { Component, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { JourneyApi } from '../../core/api/generated/journey';
import { HolderAuthService } from '../../core/auth/holder-auth.service';
import { stepUrl } from '../../core/journey/journey-navigator';
import { errorUrl } from '../error/error-reason';

/**
 * Vuelta del Verifier (design.md §3.1, puntos 2 a 4): canjea el código, abre
 * el recorrido con el Access Token y sigue al paso que dice el servicio. Si
 * el Verifier vuelve con un error, la validación falla o el servicio no abre
 * el recorrido, descarta los tokens y muestra la identificación no completada.
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
    await this.router.navigate(await this.destination(), { replaceUrl: true });
  }

  private async destination(): Promise<string[]> {
    if (!(await this.auth.completeLogin(this.document.location.href))) {
      return errorUrl('identification-failed');
    }
    try {
      return stepUrl(await firstValueFrom(this.journeyApi.openJourney()));
    } catch {
      this.auth.discard();
      return errorUrl('identification-failed');
    }
  }
}
