/**
 * Tipos del Portal de Emisión + contrato de la frontera Identificación → Emisión.
 *
 * Duplicado intencional de `eudistack-cgcom-mfe-cert-identifier/src/types.ts`
 * hasta que exista un paquete de contrato formal (EUDISTACK-621/622).
 */

export interface CertificateSubject {
  commonName?: string;
  givenName?: string;
  surname?: string;
  /** DNI en certificados españoles */
  serialNumber?: string;
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
  authMethod: 'eDNI' | 'certificate' | 'claveMobile' | 'doctorId' | 'video';
  certificateData?: CertificateData;
}

/**
 * Discriminated union del resultado del bootstrap.
 * Siempre gestionar ambos casos en el código llamante.
 */
export type BootstrapResult =
  | { success: true; credentialOfferUrl: string }
  | { success: false; error: string };

export interface CredentialTemplate {
  id: string;
  name: string;
  description: string;
  issuer: string;
  type: string;
  status: 'available' | 'issued' | 'revoked';
  validityYears: number;
  attributes: Array<{ key: string; value: string }>;
  /** Nombre del icono lucide-angular (kebab-case, p.ej. 'shield', 'file-check') */
  icon: string;
  color: string;
}

export interface IssuedCredential {
  id: string;
  templateId: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'revoked';
  credentialId: string;
}
