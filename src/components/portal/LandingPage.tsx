import { Shield, Smartphone, Lock, FileCheck, MessageCircle, AlertCircle, ChevronRight, CheckCircle, LogIn } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { Page } from '../../types';

export interface LandingPageProps {
  onNavigate: (page: Page) => void;
  onLogin: () => void;
}

export function LandingPage({ onNavigate, onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <img src="/cgcom-header-logo.svg" alt="CGCOM - Organización Médica Colegial" className="h-12 w-auto" />
              <div className="border-l border-gray-300 pl-6">
                <p className="text-sm font-medium text-gray-700">Cartera de Identidad Digital</p>
              </div>
            </div>
            <Button
              onClick={onLogin}
              className="bg-[#E67E22] hover:bg-[#D35400] text-white"
            >
              <LogIn className="mr-2 w-4 h-4" />
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#1A5276] to-[#2874A6] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                Tu Identidad Profesional Digital
              </h2>
              <p className="text-xl mb-8 text-blue-100">
                Sistema seguro de credenciales verificables para médicos colegiados.
                Accede a servicios sanitarios con la máxima seguridad y confianza.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => onNavigate('auth')}
                  className="bg-[#E67E22] hover:bg-[#D35400] text-white"
                >
                  Obtener mi DoctorID
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onNavigate('incidents')}
                  className="bg-white/10 border-white text-white hover:bg-white/20"
                >
                  <AlertCircle className="mr-2 w-5 h-5" />
                  Canal de Soporte
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <img
                src="/doctor-hero.jpg"
                alt="Médico profesional"
                className="rounded-lg shadow-2xl w-full h-96 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              ¿Qué es la Cartera de Identidad Digital?
            </h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Un sistema innovador que te permite gestionar tus credenciales profesionales
              de forma segura y acceder a servicios sanitarios con un solo clic.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#E67E22]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#E67E22]" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Máxima Seguridad</h4>
              <p className="text-gray-600">
                Credenciales verificables con tecnología blockchain y autenticación Cl@ve
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#1A5276]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-[#1A5276]" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Acceso Móvil</h4>
              <p className="text-gray-600">
                Usa tu smartphone para autenticarte en cualquier servicio sanitario
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#E67E22]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#E67E22]" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Control Total</h4>
              <p className="text-gray-600">
                Tú decides qué información compartir y con quién en cada momento
              </p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#1A5276]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileCheck className="w-8 h-8 text-[#1A5276]" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Credenciales Oficiales</h4>
              <p className="text-gray-600">
                Emitidas y verificadas por el Consejo General de Colegios de Médicos
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Cómo Funciona
            </h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Obtén tus credenciales digitales en 3 sencillos pasos
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#E67E22] text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                1
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">
                Autenticación con Cl@ve
              </h4>
              <p className="text-gray-600">
                Inicia sesión de forma segura usando tu eDNI, certificado digital o la app móvil de Cl@ve
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-[#1A5276] text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                2
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">
                Verificación de Datos
              </h4>
              <p className="text-gray-600">
                Confirmamos tu información con el registro oficial del CGCOM automáticamente
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-[#E67E22] text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                3
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">
                Emite tus Credenciales
              </h4>
              <p className="text-gray-600">
                Genera tus credenciales digitales y descárgalas en tu dispositivo móvil
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button
              size="lg"
              onClick={() => onNavigate('auth')}
              className="bg-[#E67E22] hover:bg-[#D35400] text-white"
            >
              Comenzar Ahora
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Casos de Uso
            </h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Accede a múltiples servicios sanitarios con una sola identidad digital
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'Receta Electrónica',
                description: 'Prescribe medicamentos de forma digital con tu credencial profesional'
              },
              {
                title: 'Telemedicina',
                description: 'Autentícate en plataformas de consulta online de manera segura'
              },
              {
                title: 'Acceso Hospitalario',
                description: 'Identifícate en sistemas hospitalarios sin múltiples contraseñas'
              },
              {
                title: 'Historia Clínica Digital',
                description: 'Consulta historiales médicos con credenciales verificadas'
              },
              {
                title: 'Sistemas Autonómicos',
                description: 'Compatible con todas las plataformas sanitarias regionales'
              },
              {
                title: 'Servicios del Colegio',
                description: 'Accede a todos los servicios de tu colegio oficial de médicos'
              }
            ].map((useCase, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">{useCase.title}</h4>
                    <p className="text-gray-600">{useCase.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#1A5276] to-[#2874A6] rounded-2xl p-12 text-center text-white">
            <MessageCircle className="w-16 h-16 mx-auto mb-6" />
            <h3 className="text-3xl font-bold mb-4">
              ¿Necesitas Ayuda?
            </h3>
            <p className="text-xl mb-8 text-blue-100">
              Nuestro equipo está disponible para resolver tus dudas y ayudarte en el proceso
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => onNavigate('incidents')}
                className="bg-white text-[#1A5276] hover:bg-gray-100"
              >
                <AlertCircle className="mr-2 w-5 h-5" />
                Reportar Incidencia
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 border-white text-white hover:bg-white/20"
                onClick={() => {
                  const email = 'soporte@cgcom-identidad.es';
                  window.location.href = `mailto:${email}`;
                }}
              >
                Contactar por Email
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/cgcom-logo.png" alt="CGCOM" className="h-10 w-auto" />
              </div>
              <p className="text-sm">
                Consejo General de Colegios Oficiales de Médicos de España
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Enlaces Útiles</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-[#E67E22]">Aviso Legal</a></li>
                <li><a href="#" className="hover:text-[#E67E22]">Política de Privacidad</a></li>
                <li><a href="#" className="hover:text-[#E67E22]">Términos y Condiciones</a></li>
                <li><a href="#" className="hover:text-[#E67E22]">Accesibilidad</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm">
                <li>Email: soporte@cgcom-identidad.es</li>
                <li>Teléfono: 900 123 456</li>
                <li>Horario: L-V 9:00-18:00</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>
              © {new Date().getFullYear()} CGCOM - Todos los derechos reservados
              <span className="mx-3">•</span>
              Desarrollado por <span className="text-[#E67E22] font-semibold">Altia</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
