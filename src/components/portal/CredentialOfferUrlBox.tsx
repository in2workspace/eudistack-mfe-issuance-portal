/**
 * CredentialOfferUrlBox.tsx
 *
 * Componente atómico que muestra la Credential Offer URL en un campo de solo
 * lectura acompañado de un botón de copia al portapapeles con feedback visual.
 *
 * Cumple:
 *   - RF-003: caja de texto de solo lectura + botón de copia.
 *   - RNF-004: usa Clipboard API asíncrona moderna (Chrome 90+, Firefox 90+, Safari 14+, Edge 90+).
 *   - RNF-005: aria-label descriptivo en el botón de copia.
 *   - FA-001 de RF-003: si la API Clipboard no está disponible, falla silenciosamente
 *     dejando el campo seleccionable para copia manual.
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../ui/utils';

interface CredentialOfferUrlBoxProps {
  /** URL completa de la Credential Offer generada por el issuer. */
  url: string;
}

/**
 * Muestra la Credential Offer URL en un campo de solo lectura con un botón
 * de copia al portapapeles. El icono cambia a Check durante 2 segundos tras
 * una copia exitosa y vuelve a Copy automáticamente.
 *
 * Si `navigator.clipboard` no está disponible o los permisos son denegados,
 * el error se captura silenciosamente: el campo sigue siendo seleccionable
 * para que el usuario pueda copiar la URL manualmente.
 */
export function CredentialOfferUrlBox({ url }: CredentialOfferUrlBoxProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // FA-001 de RF-003: Clipboard API no disponible o permisos denegados.
      // Se ignora el error — el campo readOnly sigue siendo seleccionable.
    }
  }

  return (
    <div className="w-full mt-4">
      <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
        URL de la oferta de credencial
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className={cn(
            'flex-1 min-w-0 px-3 py-2 text-xs font-mono',
            'bg-gray-50 border border-gray-200 rounded-md',
            'text-gray-700 select-all cursor-text',
            'focus:outline-none focus:ring-2 focus:ring-[#1A5276]/30 focus:border-[#1A5276]',
          )}
          aria-label="URL de oferta de credencial"
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar URL de oferta de credencial"
          title={copied ? 'Copiado' : 'Copiar URL'}
          className={cn(
            'flex-shrink-0 flex items-center justify-center',
            'w-9 h-9 rounded-md border transition-colors duration-150',
            copied
              ? 'border-green-500 bg-green-50 text-green-600'
              : 'border-gray-200 bg-white text-gray-500 hover:border-[#1A5276] hover:text-[#1A5276] hover:bg-[#1A5276]/5',
          )}
        >
          {copied ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {copied && (
        <p className="mt-1 text-xs text-green-600" role="status" aria-live="polite">
          URL copiada al portapapeles
        </p>
      )}
    </div>
  );
}
