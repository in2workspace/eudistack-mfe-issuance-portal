import { QRCodeSVG } from 'qrcode.react';

interface CredentialQRPayload {
  protocol: 'cgcom-wallet';
  action: 'issue';
  credentialId: string;
  credentialType: string;
  userId: string;
  name: string;
  collegiateNumber: string;
  college: string;
  specialty: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface CredentialQRCodeProps {
  credentialId: string;
  credentialType: string;
  userId: string;
  name: string;
  collegiateNumber: string;
  college: string;
  specialty: string;
  /** Tamaño en píxeles del QR (default: 220) */
  size?: number;
}

function generateNonce(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function buildQRPayload(props: Omit<CredentialQRCodeProps, 'size'>): string {
  const now = Date.now();
  const ttlMs = 10 * 60 * 1000; // 10 minutos

  const payload: CredentialQRPayload = {
    protocol: 'cgcom-wallet',
    action: 'issue',
    credentialId: props.credentialId,
    credentialType: props.credentialType,
    userId: props.userId,
    name: props.name,
    collegiateNumber: props.collegiateNumber,
    college: props.college,
    specialty: props.specialty,
    issuedAt: now,
    expiresAt: now + ttlMs,
    nonce: generateNonce(),
  };

  return JSON.stringify(payload);
}

export function CredentialQRCode({
  credentialId,
  credentialType,
  userId,
  name,
  collegiateNumber,
  college,
  specialty,
  size = 280,
}: CredentialQRCodeProps) {
  // El payload se construye una sola vez al montar el componente, igual que el
  // comportamiento anterior con useState(() => ...) en CredentialQRPage.
  const qrValue = buildQRPayload({
    credentialId,
    credentialType,
    userId,
    name,
    collegiateNumber,
    college,
    specialty,
  });

  return (
    <QRCodeSVG
      value={qrValue}
      size={size}
      // Nivel H (30 % de corrección de errores): máxima tolerancia a reflejos
      // de pantalla, cámaras de baja calidad y distorsión al escanear.
      level="H"
      includeMargin={true}
    />
  );
}

/** Extrae los primeros 8 caracteres del nonce para mostrarlo como código legible */
export function extractDisplayCode(qrValue: string): string {
  try {
    const payload: CredentialQRPayload = JSON.parse(qrValue);
    return payload.nonce.slice(0, 8).toUpperCase();
  } catch {
    return '--------';
  }
}
