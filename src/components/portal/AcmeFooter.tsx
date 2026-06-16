/**
 * AcmeFooter — barra de pie de página corporativa ACME.
 *
 * Componente sin props, reutilizable en AcmeLandingPage y AcmeHomePage.
 * Todos los enlaces son no-op intencionadamente (maqueta visual).
 */
export function AcmeFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-3 z-20 relative">
      <div className="max-w-7xl mx-auto px-4 text-center text-xs space-x-3">
        <span>© {new Date().getFullYear()} Acme Corp</span>
        <span>·</span>
        <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white">
          Política de cookies
        </a>
        <span>·</span>
        <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white">
          Accesibilidad
        </a>
        <span>·</span>
        <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white">
          Aviso Legal
        </a>
      </div>
    </footer>
  );
}
