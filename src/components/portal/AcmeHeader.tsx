/**
 * AcmeHeader — cabecera corporativa ACME reutilizable.
 *
 * Props:
 * - `actions` (opcional): nodo React que se renderiza a la derecha de la cabecera.
 *   Útil para inyectar botones contextuales como "Salir" en AcmeHomePage.
 *   Cuando no se proporciona, la cabecera solo muestra logo y título (misma
 *   apariencia que el header inline original de AcmeLandingPage).
 */
interface AcmeHeaderProps {
  actions?: React.ReactNode;
}

export function AcmeHeader({ actions }: AcmeHeaderProps) {
  return (
    <header className="bg-white shadow-sm z-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img
              src="/acme-logo.png"
              alt="ACME Corp"
              className="h-10 w-auto"
            />
            <span className="text-xl sm:text-2xl font-bold text-[#1A5276] leading-tight">
              Portal del Profesional de ACME
            </span>
          </div>
          {actions && (
            <div className="flex items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
