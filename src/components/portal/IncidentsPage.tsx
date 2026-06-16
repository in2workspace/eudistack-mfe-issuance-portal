import { useState } from 'react';
import { AlertCircle, ArrowLeft, Send, Phone, Mail, Clock, CheckCircle, LogIn } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import type { Page } from '../../types';

interface IncidentsPageProps {
  onBack: () => void;
  onNavigate: (page: Page) => void;
  onLogin: () => void;
}

type IncidentType = 'technical' | 'access' | 'credentials' | 'other';

export function IncidentsPage({ onBack, onNavigate, onLogin }: IncidentsPageProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    incidentType: '' as IncidentType | '',
    subject: '',
    description: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simular envío del formulario
    setTimeout(() => {
      setSubmitted(true);
    }, 500);
  };

  const incidentTypes = [
    { value: 'technical', label: 'Problema Técnico' },
    { value: 'access', label: 'Problemas de Acceso' },
    { value: 'credentials', label: 'Gestión de Credenciales' },
    { value: 'other', label: 'Otro' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <div className="lg:col-span-2">
            {!submitted ? (
              <Card className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    ¿Necesitas ayuda?
                  </h2>
                  <p className="text-gray-600">
                    Completa el formulario y nuestro equipo te responderá lo antes posible.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name">Nombre completo *</Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-2"
                        placeholder="Tu nombre"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-2"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-2"
                        placeholder="+34 600 000 000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="incidentType">Tipo de incidencia *</Label>
                      <select
                        id="incidentType"
                        required
                        value={formData.incidentType}
                        onChange={(e) => setFormData({ ...formData, incidentType: e.target.value as IncidentType })}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                      >
                        <option value="">Selecciona un tipo</option>
                        {incidentTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subject">Asunto *</Label>
                    <Input
                      id="subject"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="mt-2"
                      placeholder="Resume tu consulta"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Descripción del problema *</Label>
                    <Textarea
                      id="description"
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-2"
                      rows={6}
                      placeholder="Describe detalladamente el problema que estás experimentando..."
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <strong>Tiempo de respuesta:</strong> Intentaremos responder a tu solicitud en un plazo de 24-48 horas laborables.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onBack}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#E67E22] hover:bg-[#D35400] text-white"
                    >
                      <Send className="mr-2 w-5 h-5" />
                      Enviar Incidencia
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  ¡Incidencia Enviada!
                </h2>
                <p className="text-gray-600 mb-2">
                  Hemos recibido tu solicitud correctamente.
                </p>
                <p className="text-gray-600 mb-8">
                  Recibirás una respuesta en <strong>{formData.email}</strong> en un plazo de 24-48 horas laborables.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    <strong>Número de ticket:</strong> INC-{Date.now().toString().slice(-8)}
                  </p>
                </div>
                <Button
                  onClick={onBack}
                  className="bg-[#E67E22] hover:bg-[#D35400] text-white"
                >
                  Volver al Inicio
                </Button>
              </Card>
            )}
          </div>

          {/* Información de contacto */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">
                Otros Canales de Contacto
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[#1A5276] flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Teléfono</p>
                    <p className="text-sm text-gray-600">900 123 456</p>
                    <p className="text-xs text-gray-500">Gratuito desde España</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#1A5276] flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Email</p>
                    <p className="text-sm text-gray-600">soporte@cgcom-identidad.es</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#1A5276] flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Horario</p>
                    <p className="text-sm text-gray-600">Lunes a Viernes</p>
                    <p className="text-sm text-gray-600">9:00 - 18:00 (CET)</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-amber-50 border-amber-200">
              <h4 className="font-bold text-gray-900 mb-3">
                Antes de contactar
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#E67E22] mt-1">•</span>
                  <span>Consulta nuestras <a href="#" className="text-[#1A5276] font-semibold hover:underline">Preguntas Frecuentes</a></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#E67E22] mt-1">•</span>
                  <span>Revisa la <a href="#" className="text-[#1A5276] font-semibold hover:underline">Guía de Usuario</a></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#E67E22] mt-1">•</span>
                  <span>Ten a mano tu número de colegiado</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
