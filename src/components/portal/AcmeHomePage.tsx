import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Users, Shield } from 'lucide-react';
import { AcmeHeader } from './AcmeHeader';
import { AcmeFooter } from './AcmeFooter';

const DEMO_USER_NAME = 'Dr. García López';

const SERVICIOS = [
  {
    titulo: 'Receta Electrónica',
    descripcion: 'Emite y gestiona recetas electrónicas para tus pacientes de forma segura y verificable.',
    icono: FileText,
    color: '#E67E22',
  },
  {
    titulo: 'Agenda Clínica',
    descripcion: 'Consulta y organiza tu agenda de citas, turnos y disponibilidad en el centro.',
    icono: Calendar,
    color: '#1A5276',
  },
  {
    titulo: 'Directorio de Pacientes',
    descripcion: 'Accede al directorio de pacientes asignados y consulta su historial clínico.',
    icono: Users,
    color: '#2874A6',
  },
  {
    titulo: 'Certificados Profesionales',
    descripcion: 'Descarga y gestiona tus credenciales y certificados profesionales verificables.',
    icono: Shield,
    color: '#D35400',
  },
];

export function AcmeHomePage() {
  const navigate = useNavigate();

  const handleSalir = () => navigate('/cliente', { replace: true });

  const botonSalir = (
    <button
      type="button"
      onClick={handleSalir}
      className="px-4 py-2 border-2 border-[#1A5276] text-[#1A5276] text-sm font-semibold rounded-md hover:bg-[#1A5276] hover:text-white transition-colors"
    >
      Salir
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <AcmeHeader actions={botonSalir} />

      <main className="flex-1 flex flex-col items-center justify-center py-12 px-4">
        <div className="max-w-4xl mx-auto w-full space-y-10">
          {/* Saludo */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Hola, {DEMO_USER_NAME}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                Sesión activa
              </span>
            </div>
            <h2 className="text-xl text-[#1A5276] font-semibold mt-4">
              Portal de servicios para el profesional de Clínicas Acme Corp
            </h2>
          </div>

          {/* Grid de servicios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {SERVICIOS.map((servicio) => {
              const Icono = servicio.icono;
              return (
                <div
                  key={servicio.titulo}
                  className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${servicio.color}15` }}
                  >
                    <Icono className="w-6 h-6" style={{ color: servicio.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {servicio.titulo}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {servicio.descripcion}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {}} // no-op (maqueta visual)
                    className="mt-auto self-start px-4 py-2 text-sm font-semibold rounded-md transition-colors"
                    style={{
                      color: servicio.color,
                      border: `2px solid ${servicio.color}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = servicio.color;
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = servicio.color;
                    }}
                  >
                    Acceder
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <AcmeFooter />
    </div>
  );
}
