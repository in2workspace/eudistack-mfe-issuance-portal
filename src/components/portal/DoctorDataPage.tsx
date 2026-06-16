import { CheckCircle, Info, User, ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import type { AuthenticatedUser } from '../../types';

interface DoctorDataPageProps {
  user: AuthenticatedUser;
  onContinue: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export function DoctorDataPage({ user, onContinue, onCancel, isLoading, error }: DoctorDataPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                onClick={onCancel}
                className="text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
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
              <User className="w-10 h-10 text-[#1A5276]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Datos del Médico
            </h2>
            <p className="text-gray-600">
              Confirma que tus datos son correctos antes de continuar
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="font-bold text-gray-900 mb-4">
              Datos obtenidos del sistema CGCOM
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: 'Nombre completo',     value: user.name },
                { label: 'Número de colegiado', value: user.collegiateNumber },
                { label: 'DNI',                 value: user.dni },
                { label: 'Colegio Provincial',  value: user.college },
                { label: 'Especialidad',         value: user.specialty },
              ].map((field) => (
                <div key={field.label} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{field.label}</p>
                    <p className="text-sm text-gray-600">{field.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Alert className="mb-8 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Estos datos han sido obtenidos del sistema de información de CGCOM.
              Si detectas algún error, contacta con tu Colegio Provincial.
            </AlertDescription>
          </Alert>

          {error !== null && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={onContinue}
              disabled={isLoading}
              className="flex-1 bg-[#E67E22] hover:bg-[#D35400] text-white disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
