import { Router } from '@angular/router';

/**
 * "Volver a" tras completar/cancelar el flujo de emisión — cuando se entra
 * desde una app externa (p.ej. eudistack-cgcom-mfe-demo, CTA "Obtener mi
 * DoctorID"/"Comenzar Ahora"), esa app deja aquí la URL a la que debe
 * volver el usuario al terminar. Mismo origin (AD-2): sessionStorage se
 * comparte entre /demo/ y /issuance-portal/ bajo el mismo host de tenant.
 */
const KEY = 'issuance_return_to';

function resolveIssuanceReturnTo(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function clearIssuanceReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Navega de vuelta al origen externo (cross-app, full reload) si el flujo
 * se inició desde fuera; si no, navega a `fallbackPath` dentro de la propia
 * SPA (comportamiento por defecto de siempre).
 */
export function navigateBackToOrigin(router: Router, fallbackPath: string): void {
  const returnTo = resolveIssuanceReturnTo();
  if (returnTo) {
    clearIssuanceReturnTo();
    window.location.href = returnTo;
    return;
  }
  router.navigate([fallbackPath]);
}
