/**
 * Tipos del Portal de Emisión + contrato de la frontera Identificación → Emisión.
 *
 * `AuthenticatedUser` / `CertificateData` / `CertificateSubject` definen el handoff
 * con el Portal de Identificación con certificado FNMT
 * (`eudistack-cgcom-mfe-cert-identifier`).
 *
 * ⚠️ DUPLICADO INTENCIONAL de esos tres tipos: la misma definición vive en
 * `eudistack-cgcom-mfe-cert-identifier/src/types.ts`. Al separar la demo monolítica
 * (`demo-cgcom/src/portal.tsx`) en dos SPAs, el tipo compartido se duplica a ambos
 * lados de la frontera. Mantener en sync hasta que exista un paquete de contrato
 * o se formalice vía SDD (Épicas EUDISTACK-621 / EUDISTACK-622).
 *
 * `Page` y `CredentialTemplate` son internos del Portal de Emisión (no cruzan frontera).
 */

export interface CertificateSubject {
  commonName?: string;
  givenName?: string;
  surname?: string;
  serialNumber?: string; // DNI en certificados españoles
  organization?: string;
  organizationalUnit?: string;
  organizationIdentifier?: string;
  country?: string;
  locality?: string;
  province?: string;
  streetAddress?: string;
  postalCode?: string;
  emailAddress?: string;
  [key: string]: string | undefined;
}

export interface CertificateData {
  subject: CertificateSubject;
  issuer: CertificateSubject;
  validFrom: string;
  validTo: string;
  certificateType: 'personal' | 'organizational';
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  collegiateNumber: string;
  dni: string;
  email: string;
  phone: string;
  college: string;
  specialty: string;
  authMethod: 'eDNI' | 'certificate' | 'claveMobile';
  certificateData?: CertificateData;
}

/** Páginas internas del flujo de emisión. `auth` vive ahora en el repo de identificación. */
export type Page =
  | 'landing'
  | 'doctor-data'
  | 'qr-credential'
  | 'credential-success'
  | 'portal'
  | 'incidents';

export interface CredentialTemplate {
  id: string;
  name: string;
  description: string;
  issuer: string;
  type: string;
  status: 'available' | 'issued' | 'revoked';
  validityYears: number;
  attributes: Array<{
    key: string;
    value: string;
  }>;
  icon: any;
  color: string;
}
