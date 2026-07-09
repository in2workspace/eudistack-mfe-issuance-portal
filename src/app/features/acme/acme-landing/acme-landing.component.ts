import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AcmeHeaderComponent } from '../acme-header/acme-header.component';
import { AcmeFooterComponent } from '../acme-footer/acme-footer.component';
import { AcmeOidcService } from '../../../core/services/acme-oidc.service';

/**
 * Pantalla de login del portal ACME.
 * Equivalente a AcmeLandingPage.tsx (React).
 *
 * RF-001 — Detección de callback OIDC: si la URL trae ?code=, redirige a /cliente/home.
 * El flujo OIDC PKCE está encapsulado en AcmeOidcService.
 */
@Component({
  selector: 'app-acme-landing',
  imports: [CommonModule, AcmeHeaderComponent, AcmeFooterComponent],
  templateUrl: './acme-landing.component.html',
})
export class AcmeLandingComponent implements OnInit {
  private router = inject(Router);
  private oidc = inject(AcmeOidcService);

  ngOnInit(): void {
    // RF-001: callback OIDC — si ?code= está presente, redirigir a /cliente/home
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      this.router.navigate(['/cliente/home'], { replaceUrl: true });
    }
  }

  onIniciarFlujoOIDC(): void {
    this.oidc.iniciarFlujo();
  }
}
