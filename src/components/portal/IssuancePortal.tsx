import { useState } from 'react';
import { Shield, Download, RotateCw, Trash2, CheckCircle, QrCode, Smartphone, ArrowLeft, ChevronRight, FileCheck, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CredentialQRCode } from './CredentialQRCode';
import type { AuthenticatedUser, CredentialTemplate } from '../../types';

interface IssuancePortalProps {
  user: AuthenticatedUser;
  onLogout: () => void;
}

export function IssuancePortal({ user, onLogout }: IssuancePortalProps) {
  const [selectedCredential, setSelectedCredential] = useState<CredentialTemplate | null>(null);
  const [issuanceStep, setIssuanceStep] = useState<'list' | 'confirm' | 'qr' | 'success'>('list');

  // Mock de credenciales disponibles basadas en los datos del usuario
  const availableCredentials: CredentialTemplate[] = [
    {
      id: 'doctor-id',
      name: 'Credencial de Identificación Médica (DoctorID)',
      description: 'Credencial principal que te identifica como médico colegiado en España',
      issuer: 'CGCOM',
      type: 'DoctorID',
      status: 'available',
      validityYears: 2,
      attributes: [
        { key: 'Nombre completo', value: user.name },
        { key: 'Número de colegiado', value: user.collegiateNumber },
        { key: 'DNI', value: user.dni },
        { key: 'Colegio Provincial', value: user.college },
        { key: 'Especialidad', value: user.specialty }
      ],
      icon: Shield,
      color: '#E67E22'
    },
    {
      id: 'ecip',
      name: 'Tarjeta Profesional Europea (eCIP)',
      description: 'Credencial para ejercer temporalmente en otros países de la UE',
      issuer: 'CGCOM',
      type: 'eCIP',
      status: 'available',
      validityYears: 1,
      attributes: [
        { key: 'Nombre completo', value: user.name },
        { key: 'Número de colegiado', value: user.collegiateNumber },
        { key: 'País de origen', value: 'España' },
        { key: 'Especialidad', value: user.specialty }
      ],
      icon: FileCheck,
      color: '#1A5276'
    }
  ];

  // Mock de credenciales ya emitidas
  const [issuedCredentials, setIssuedCredentials] = useState([
    {
      id: 'issued-1',
      templateId: 'doctor-id',
      name: 'Credencial de Identificación Médica (DoctorID)',
      issueDate: '2024-01-15',
      expiryDate: '2026-01-15',
      status: 'active' as const,
      credentialId: 'CGCOM-DR-12345-2024'
    }
  ]);

  const handleStartIssuance = (credential: CredentialTemplate) => {
    setSelectedCredential(credential);
    setIssuanceStep('confirm');
  };

  const handleConfirmIssuance = () => {
    setIssuanceStep('qr');
  };

  const handleCompleteIssuance = () => {
    // Simular emisión exitosa
    if (selectedCredential) {
      const newCredential = {
        id: `issued-${Date.now()}`,
        templateId: selectedCredential.id,
        name: selectedCredential.name,
        issueDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + selectedCredential.validityYears * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active' as const,
        credentialId: `CGCOM-${selectedCredential.type.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      };
      setIssuedCredentials([...issuedCredentials, newCredential]);
    }
    setIssuanceStep('success');
  };

  const handleRevokeCredential = (credentialId: string) => {
    if (confirm('¿Estás seguro de que deseas revocar esta credencial? Esta acción no se puede deshacer.')) {
      setIssuedCredentials(
        issuedCredentials.map(c =>
          c.id === credentialId ? { ...c, status: 'revoked' as const } : c
        )
      );
    }
  };

  const handleReissueCredential = (credentialId: string) => {
    const credential = issuedCredentials.find(c => c.id === credentialId);
    if (credential) {
      const template = availableCredentials.find(t => t.id === credential.templateId);
      if (template) {
        setSelectedCredential(template);
        setIssuanceStep('confirm');
      }
    }
  };

  const resetFlow = () => {
    setSelectedCredential(null);
    setIssuanceStep('list');
  };

  if (issuanceStep === 'confirm' && selectedCredential) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-6">
                <Button variant="ghost" onClick={resetFlow} className="text-gray-600">
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
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`} style={{ backgroundColor: `${selectedCredential.color}20` }}>
                <selectedCredential.icon className="w-10 h-10" style={{ color: selectedCredential.color }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedCredential.name}
              </h2>
              <p className="text-gray-600">
                {selectedCredential.description}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="font-bold text-gray-900 mb-4">Datos que se incluirán en la credencial:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {selectedCredential.attributes.map((attr, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{attr.key}</p>
                      <p className="text-sm text-gray-600">{attr.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Alert className="mb-8">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Esta credencial será válida por <strong>{selectedCredential.validityYears} año{selectedCredential.validityYears > 1 ? 's' : ''}</strong> desde su fecha de emisión. 
                Podrás revocarla o renovarla en cualquier momento desde este portal.
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={resetFlow}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmIssuance}
                className="flex-1 bg-[#E67E22] hover:bg-[#D35400] text-white"
              >
                Continuar
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (issuanceStep === 'qr' && selectedCredential) {
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

            <div className="bg-gray-50 rounded-lg p-8 mb-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <CredentialQRCode
                  credentialId={selectedCredential.id}
                  credentialType={selectedCredential.type}
                  userId={user.id}
                  name={user.name}
                  collegiateNumber={user.collegiateNumber}
                  college={user.college}
                  specialty={user.specialty}
                  size={220}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-4">
                Nº Colegiado: {user.collegiateNumber}
              </p>
            </div>

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
                onClick={resetFlow}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCompleteIssuance}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="mr-2 w-5 h-5" />
                Marcar como Completado
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (issuanceStep === 'success') {
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
              ¡Credencial Emitida con Éxito!
            </h2>
            <p className="text-gray-600 mb-8">
              Tu credencial <strong>{selectedCredential?.name}</strong> ha sido emitida y descargada en tu dispositivo móvil.
            </p>
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <div className="grid md:grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-600 mb-1">ID de Credencial</p>
                  <p className="font-semibold text-gray-900">CGCOM-{selectedCredential?.type.toUpperCase()}-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Fecha de Emisión</p>
                  <p className="font-semibold text-gray-900">{new Date().toLocaleDateString('es-ES')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Válida Hasta</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(Date.now() + (selectedCredential?.validityYears || 2) * 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Estado</p>
                  <Badge className="bg-green-100 text-green-800">Activa</Badge>
                </div>
              </div>
            </div>
            <Button
              onClick={resetFlow}
              className="bg-[#E67E22] hover:bg-[#D35400] text-white"
            >
              Volver al Portal
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-600">Nº Colegiado: {user.collegiateNumber}</p>
              </div>
              <Button variant="outline" onClick={onLogout} className="text-gray-600">
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Bienvenido/a, {user.name.split(' ').slice(0, 2).join(' ')}
          </h2>
          <p className="text-xl text-gray-600">
            Gestiona tus credenciales digitales de forma segura
          </p>
        </div>

        {/* User Info Card */}
        <Card className="p-6 mb-12 bg-gradient-to-br from-[#1A5276] to-[#2874A6] text-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-xl mb-4">Información del Profesional</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-blue-100 text-sm mb-1">Nombre Completo</p>
                  <p className="font-semibold">{user.name}</p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm mb-1">Número de Colegiado</p>
                  <p className="font-semibold">{user.collegiateNumber}</p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm mb-1">DNI</p>
                  <p className="font-semibold">{user.dni}</p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm mb-1">Colegio Provincial</p>
                  <p className="font-semibold">{user.college}</p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm mb-1">Especialidad</p>
                  <p className="font-semibold">{user.specialty}</p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm mb-1">Email</p>
                  <p className="font-semibold">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Available Credentials */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Credenciales Disponibles para Emitir
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {availableCredentials.map((credential) => {
              const Icon = credential.icon;
              const alreadyIssued = issuedCredentials.some(
                ic => ic.templateId === credential.id && ic.status === 'active'
              );
              
              return (
                <Card key={credential.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4 mb-4">
                    <div 
                      className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${credential.color}20` }}
                    >
                      <Icon className="w-7 h-7" style={{ color: credential.color }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{credential.name}</h4>
                      <p className="text-sm text-gray-600">{credential.description}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Emisor:</strong> {credential.issuer}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Validez:</strong> {credential.validityYears} año{credential.validityYears > 1 ? 's' : ''}
                    </p>
                  </div>
                  {alreadyIssued && (
                    <Badge className="mb-4 bg-green-100 text-green-800">
                      Ya tienes una credencial activa
                    </Badge>
                  )}
                  <Button
                    onClick={() => handleStartIssuance(credential)}
                    className="w-full"
                    style={{ backgroundColor: credential.color }}
                  >
                    <Download className="mr-2 w-5 h-5" />
                    {alreadyIssued ? 'Emitir Nueva' : 'Emitir Credencial'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
