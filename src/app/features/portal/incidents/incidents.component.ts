import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Incident, IncidentsApi } from '../../../core/api/generated/journey';
import { PortalConfigService } from '../../../core/config/portal-config.service';
import { INCIDENT_SENT_PATH } from './incident-sent.route';
import { IncidentSentStore } from './incident-sent.store';

/** Tipos de incidencia del contrato, en el orden del formulario. */
const INCIDENT_TYPES: readonly Incident.TypeEnum[] = ['technical', 'access', 'credentials', 'other'];

/**
 * Ayuda (prd.md §3.2, wireframes, Ayuda): el titular envía una incidencia al
 * soporte de su tenant con `POST /incidents`, sin identificarse. Si el envío
 * falla, se le avisa y se conserva lo escrito. Al lado, los datos de soporte
 * de `GET /config`.
 */
@Component({
  selector: 'app-incidents',
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './incidents.component.html',
})
export class IncidentsComponent {
  private readonly router = inject(Router);
  private readonly incidents = inject(IncidentsApi);
  private readonly portalConfig = inject(PortalConfigService);
  private readonly sent = inject(IncidentSentStore);

  protected readonly types = INCIDENT_TYPES;

  /** Longitudes máximas del contrato (`Incident`). */
  protected readonly maxLength = { name: 200, phone: 30, subject: 200, description: 5000 } as const;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(this.maxLength.name)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(this.maxLength.phone)] }),
    type: new FormControl<Incident.TypeEnum | ''>('', { nonNullable: true, validators: [Validators.required] }),
    subject: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(this.maxLength.subject)] }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.maxLength.description)],
    }),
  });

  protected readonly sending = signal(false);
  protected readonly failed = signal(false);

  /** Datos de soporte del tenant; un dato que falta no se muestra. */
  protected readonly support = computed(() => this.portalConfig.config()?.support ?? {});

  protected readonly hasSupport = computed(() => {
    const support = this.support();
    return Boolean(support.email || support.phone || support.schedule);
  });

  onCancel(): Promise<boolean> {
    return this.router.navigate(['/']);
  }

  onSubmit(): void {
    if (this.form.invalid || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.failed.set(false);
    this.incidents.sendIncident(this.toIncident()).subscribe({
      next: ({ response_time }) => {
        this.sent.set(response_time);
        void this.router.navigateByUrl(`/${INCIDENT_SENT_PATH}`);
      },
      error: () => {
        // Cualquier fallo (400, 429, 503 o red) muestra el mismo aviso, sin detalles internos.
        this.failed.set(true);
        this.sending.set(false);
      },
    });
  }

  private toIncident(): Incident {
    const { name, email, phone, type, subject, description } = this.form.getRawValue();
    return {
      name,
      email,
      ...(phone.trim() ? { phone } : {}),
      type: type as Incident.TypeEnum,
      subject,
      description,
    };
  }
}
