import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { BrandingService } from '../../../core/branding/branding.service';
import { TenantLanguageService } from '../../../core/branding/tenant-language.service';

/** Destino del botón de volver de la ruta activa (`data.back`), o `null` si no lo lleva. */
function backOf(root: ActivatedRouteSnapshot): string | null {
  let route = root;
  while (route.firstChild) {
    route = route.firstChild;
  }
  const back: unknown = route.data['back'];
  return typeof back === 'string' ? back : null;
}

/**
 * Cabecera común de todas las pantallas (wireframes, navegación y cabecera):
 * logo del tenant, nombre del portal, selector con los idiomas del tenant y,
 * en las rutas con `data.back`, un botón para volver. La marca viene del
 * `theme.json` del tenant, así que se muestra también cuando `GET /config`
 * no está disponible.
 */
@Component({
  selector: 'app-portal-header',
  imports: [TranslateModule],
  templateUrl: './portal-header.component.html',
})
export class PortalHeaderComponent {
  private readonly router = inject(Router);
  protected readonly branding = inject(BrandingService);
  protected readonly language = inject(TenantLanguageService);

  protected readonly backTo = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => backOf(this.router.routerState.snapshot.root)),
    ),
    { initialValue: null },
  );

  constructor() {
    const title = inject(Title);
    inject(TranslateService)
      .stream('portal.app_name')
      .pipe(takeUntilDestroyed())
      .subscribe((name: string) => title.setTitle(name));
  }

  onBack(): void {
    const back = this.backTo();
    if (back !== null) {
      this.router.navigateByUrl(`/${back}`);
    }
  }

  onLanguageChange(event: Event): void {
    this.language.use((event.target as HTMLSelectElement).value);
  }
}
