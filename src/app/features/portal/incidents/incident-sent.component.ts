import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';

/**
 * Ayuda enviada (prd.md §3.2, wireframes, Ayuda enviada): la incidencia se ha
 * recibido y el plazo de respuesta es el que ha devuelto el servicio.
 */
@Component({
  selector: 'app-incident-sent',
  imports: [TranslateModule],
  templateUrl: './incident-sent.component.html',
})
export class IncidentSentComponent {
  private readonly router = inject(Router);

  protected readonly responseTime = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['responseTime'] as string)),
    { initialValue: '' },
  );

  onHome(): Promise<boolean> {
    return this.router.navigate(['/']);
  }
}
