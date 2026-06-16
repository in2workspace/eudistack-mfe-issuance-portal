import { CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import type { AuthenticatedUser } from '../../types';

interface CredentialSuccessPageProps {
  user: AuthenticatedUser;
  onContinue: () => void;
}

export function CredentialSuccessPage({ user, onContinue }: CredentialSuccessPageProps) {
  const issueDate = new Date();
  const expiryDate = new Date(issueDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 2);

  // Generamos el ID una sola vez en el renderizado — en producción vendría del backend
  const credentialId = `CGCOM-DOCTORID-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

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
        <Card className="p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Credencial Emitida con Éxito
          </h2>
          <p className="text-gray-600 mb-8">
            Tu credencial <strong>Credencial de Identificación Médica (DoctorID)</strong> ha sido emitida
            y enviada a tu dispositivo móvil. Ya puedes usarla desde la Cartera Digital CGCOM.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">ID de Credencial</p>
                <p className="font-semibold text-gray-900">{credentialId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Titular</p>
                <p className="font-semibold text-gray-900">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Fecha de Emisión</p>
                <p className="font-semibold text-gray-900">{issueDate.toLocaleDateString('es-ES')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Válida Hasta</p>
                <p className="font-semibold text-gray-900">{expiryDate.toLocaleDateString('es-ES')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Número de Colegiado</p>
                <p className="font-semibold text-gray-900">{user.collegiateNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Estado</p>
                <Badge className="bg-green-100 text-green-800">Activa</Badge>
              </div>
            </div>
          </div>

          <Button
            onClick={onContinue}
            className="bg-[#E67E22] hover:bg-[#D35400] text-white px-8"
          >
            Ir al Portal de Credenciales
          </Button>
        </Card>
      </div>
    </div>
  );
}
