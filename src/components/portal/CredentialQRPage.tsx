/**
 * CredentialQRPage.tsx
 *
 * Paso `qr` del flujo de primera emisión del portal CGCOM.
 * Muestra el QR real generado a partir de la Credential Offer URL obtenida
 * del issuer CGCOM (RF-002) y la caja de texto con la URL y botón de copia
 * (RF-003).
 *
 * Gestión de estado:
 *   - Si `credentialOfferUrl` es null, se muestra un Alert de error con la
 *     opción de volver al paso anterior (FA-001 de RF-002).
 *   - Si `credentialOfferUrl` tiene valor, se renderiza el QR y el
 *     componente CredentialOfferUrlBox debajo.
 */

import { CheckCircle, Smartphone, QrCode, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { CredentialOfferUrlBox } from './CredentialOfferUrlBox';
import type { AuthenticatedUser } from '../../types';

const WALLET_CALLBACK_BASE = import.meta.env.VITE_WALLET_CALLBACK_BASE ?? 'https://cgcom.127.0.0.1.nip.io:4443/wallet/protocol/callback';

/**
 * Construye la URL del wallet web a partir de la Credential Offer URL del issuer.
 * Extrae el param `credential_offer_uri` de `openid-credential-offer://?credential_offer_uri=...`
 * y lo recompone como `https://wallet.cgcom.demo.fikua.com/protocol/callback?credential_offer_uri=...`
 */
function buildWalletUrl(credentialOfferUrl: string): string {
  try {
    const parsed = new URL(credentialOfferUrl);
    const credentialOfferUri = parsed.searchParams.get('credential_offer_uri');
    if (credentialOfferUri) {
      return `${WALLET_CALLBACK_BASE}?credential_offer_uri=${encodeURIComponent(credentialOfferUri)}`;
    }
  } catch {
    // Si no es una URL parseable, usamos la credentialOfferUrl directamente como param
  }
  return `${WALLET_CALLBACK_BASE}?credential_offer_uri=${encodeURIComponent(credentialOfferUrl)}`;
}

interface CredentialQRPageProps {
  user: AuthenticatedUser;
  /** URL de la Credential Offer devuelta por el issuer. Null si aún no se ha
   *  obtenido o si la llamada al issuer ha fallado. */
  credentialOfferUrl: string | null;
  onComplete: () => void;
  onCancel: () => void;
  /** Callback invocado cuando el usuario pulsa "Volver a intentar" desde el
   *  estado de error (FA-001 de RF-002). Debe navegar de vuelta al paso
   *  `doctor-data` y limpiar el estado de error. */
  onRetry: () => void;
}

export function CredentialQRPage({
  user,
  credentialOfferUrl,
  onComplete,
  onCancel,
  onRetry,
}: CredentialQRPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <img src="/cgcom-header-logo.svg" alt="CGCOM - Organización Médica Colegial" className="h-12 w-auto" />
              <div className="border-l border-gray-300 pl-6">
                <p className="text-sm font-medium text-gray-700">Cartera de Identidad Digital</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#1A5276]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-10 h-10 text-[#1A5276]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Escanea el Código QR
            </h2>
            <p className="text-gray-600">
              Abrirá la aplicación Cartera Digital CGCOM en tu dispositivo y recibirás tu credencial
            </p>
          </div>

          {/* FA-001 de RF-002: guard para URL nula — muestra error y opción de reintento */}
          {credentialOfferUrl === null ? (
            <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3">
                <span>No se pudo obtener la oferta de credencial. Por favor, vuelve a intentarlo.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="self-start border-red-300 text-red-700 hover:bg-red-50"
                >
                  Volver a intentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            /* Flujo nominal: QR real + caja de URL (RF-002, RF-003) */
            <div className="bg-gray-50 rounded-lg p-8 mb-8 flex flex-col items-center">
              {/* QR clicable que abre la wallet web con la credential offer */}
              {(() => {
                const walletUrl = buildWalletUrl(credentialOfferUrl);
                return (
                  <>
                    <a
                      href={walletUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      role="img"
                      aria-label="Código QR con la oferta de credencial DoctorID — clic para abrir en la wallet"
                    >
                      <QRCodeSVG
                        value={walletUrl}
                        size={280}
                        level="H"
                        includeMargin={true}
                      />
                    </a>
                    {/* RF-003: caja de texto de solo lectura con la URL y botón de copia */}
                    <div className="w-full max-w-sm mt-2">
                      <CredentialOfferUrlBox url={walletUrl} />
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#E67E22] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <div>
                <p className="font-semibold text-gray-900">Abre la aplicación móvil</p>
                <p className="text-sm text-gray-600">Abre la Cartera Digital CGCOM en tu smartphone</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#E67E22] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <div>
                <p className="font-semibold text-gray-900">Escanea el código QR</p>
                <p className="text-sm text-gray-600">Usa el escáner de la app para escanear este código</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#E67E22] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-gray-900">Confirma la descarga</p>
                <p className="text-sm text-gray-600">Acepta la descarga en tu dispositivo móvil</p>
              </div>
            </div>
          </div>

          <Alert className="mb-8 bg-blue-50 border-blue-200">
            <QrCode className="h-4 w-4" />
            <AlertDescription>
              Este código QR es válido por <strong>10 minutos</strong>. Si necesitas más tiempo, puedes generar uno nuevo
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={onComplete}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="mr-2 w-5 h-5" />
              Marcar como completado
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
